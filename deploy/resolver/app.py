"""
Generic media resolver — a small, self-hosted tunnel service that speaks the
same request/response shape as the public Cobalt API, so the main app can use it
as a drop-in fallback via the COBALT_API_URL env var (comma/space separated list).

Why it exists: the public tunnel API only resolves a fixed set of platforms. For
any other well-formed link, the app now routes to this service. It resolves the
media server-side and then *tunnels* the bytes through this box, so the resulting
URL streams from any IP (the same trick that makes datacenter playback work) —
raw CDN URLs are usually signed against the extracting session and 403 elsewhere.

Endpoints:
  POST /            Cobalt-shaped. Body: {url, downloadMode?, videoQuality?}.
                    Returns {status:"tunnel", url, filename} or {status:"error"}.
  GET  /t?d=<tok>   Streams the resolved media (Range-aware for progressive http).
  GET  /health      Liveness probe / keep-warm ping target.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import subprocess
from typing import Any, Optional

from urllib.parse import quote

import requests
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from yt_dlp import YoutubeDL

app = FastAPI()

# Public base URL of this service. Different hosts expose it differently:
# Render injects RENDER_EXTERNAL_URL; other platforms expose the bare host via
# SPACE_HOST or KOYEB_PUBLIC_DOMAIN. Falls back to an explicit BASE_URL env, then
# localhost for dev. Set BASE_URL manually if your host isn't auto-detected.
_host_only = (
    os.environ.get("SPACE_HOST", "").strip()
    or os.environ.get("KOYEB_PUBLIC_DOMAIN", "").strip()
)
BASE_URL = (
    os.environ.get("RENDER_EXTERNAL_URL")
    or (f"https://{_host_only}" if _host_only else "")
    or os.environ.get("BASE_URL")
    or "http://localhost:8080"
).rstrip("/")


def _public_base(request: Request) -> str:
    """Playback host for tunnel links. Prefer the host the request actually
    arrived on (via the reverse proxy's forwarded headers) so a platform that
    hands out a rotating/temporary public URL still emits reachable links with
    no BASE_URL churn. Fall back to the configured BASE_URL for local/dev."""
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if forwarded_host:
        proto = request.headers.get("x-forwarded-proto", "https").split(",")[0].strip()
        return f"{proto}://{forwarded_host.split(',')[0].strip()}".rstrip("/")
    return BASE_URL

# Optional shared key. When set, callers must send `Authorization: Api-Key <key>`
# (the main app forwards COBALT_API_KEY this way). Tunnel tokens are always HMAC
# signed so /t can't be abused as an open proxy for arbitrary URLs.
API_KEY = os.environ.get("RESOLVER_API_KEY", "").strip()
SECRET = (os.environ.get("RESOLVER_SECRET", "").strip() or secrets.token_hex(16)).encode()

# Optional cookies.txt contents (Netscape format), for links that gate behind a
# login / anti-bot check. Either paste the file into RESOLVER_COOKIES, or — when
# the file is too big for a host's env-var size cap, or the host mangles the
# required tabs/newlines — point RESOLVER_COOKIES_URL at a raw URL (e.g. a secret
# Gist) and it's fetched once at boot. Written to disk either way.
COOKIEFILE: Optional[str] = None
_cookies = os.environ.get("RESOLVER_COOKIES", "")
_cookies_url = os.environ.get("RESOLVER_COOKIES_URL", "").strip()
if not _cookies.strip() and _cookies_url:
    try:
        _resp = requests.get(_cookies_url, timeout=15)
        if _resp.status_code < 400 and _resp.text.strip():
            _cookies = _resp.text
    except Exception:
        pass
if _cookies.strip():
    COOKIEFILE = "/tmp/cookies.txt"
    with open(COOKIEFILE, "w", encoding="utf-8") as fh:
        fh.write(_cookies)

# Optional upstream proxy. Some sources geo-restrict by the *client* IP and
# redirect datacenter egress to a notice/gate page (cookies can't fix that).
# Set RESOLVER_PROXY to a proxy URL (http(s)/socks5) in a region the source
# serves, and every fetch — extraction, the pipe path, and the /t upstream
# stream — routes through it.
PROXY = os.environ.get("RESOLVER_PROXY", "").strip()

# Best-effort browser impersonation (needs curl_cffi) to clear TLS/anti-bot
# fingerprint checks on the stricter sources.
try:
    from yt_dlp.networking.impersonate import ImpersonateTarget

    _IMPERSONATE = ImpersonateTarget.from_str("chrome")
except Exception:
    _IMPERSONATE = None


def _base_opts() -> dict:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }
    if COOKIEFILE:
        opts["cookiefile"] = COOKIEFILE
    if PROXY:
        opts["proxy"] = PROXY
    if _IMPERSONATE is not None:
        opts["impersonate"] = _IMPERSONATE
    return opts


def _format_for(audio: bool, quality: Optional[str]) -> str:
    if audio:
        return "bestaudio/best"
    # Prefer a single progressive http(s) rendition — it proxies with Range
    # (seekable preview) and needs no merge. Fall back to anything.
    if quality == "480":
        return (
            "best[height<=480][ext=mp4][protocol^=http]/"
            "best[height<=480][protocol^=http]/best[ext=mp4]/best"
        )
    return "best[ext=mp4][protocol^=http]/best[protocol^=http]/best[ext=mp4]/best"


def _sign(payload: dict) -> str:
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET, raw.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{raw}.{sig}"


def _unsign(token: str) -> Optional[dict]:
    try:
        raw, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    expect = hmac.new(SECRET, raw.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expect):
        return None
    pad = "=" * (-len(raw) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(raw + pad))
    except Exception:
        return None


def _safe_name(title: str, ext: str) -> str:
    stem = re.sub(r'[\\/:*?"<>|]+', "_", (title or "media")).strip() or "media"
    return f"{stem[:80]}.{ext}"


def _disposition(filename: str) -> str:
    """Build a Content-Disposition value that is safe for a latin-1 HTTP header.
    Non-latin-1 chars (emoji, curly quotes, CJK) would make the ASGI server throw
    on header encode, so we send an ASCII-only fallback plus an RFC 5987
    `filename*` carrying the real UTF-8 name."""
    ascii_name = filename.encode("ascii", "ignore").decode("ascii").strip() or "media"
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"


_LAST_ERR: str = ""


def _extract(url: str, audio: bool, quality: Optional[str]) -> Optional[dict]:
    global _LAST_ERR
    opts = _base_opts()
    opts["format"] = _format_for(audio, quality)
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        _LAST_ERR = f"{type(exc).__name__}: {exc}"
        return None
    if not info:
        return None
    # A playlist/multi-entry result — take the first playable entry.
    if info.get("_type") == "playlist" and info.get("entries"):
        entries = [e for e in info["entries"] if e]
        if not entries:
            return None
        info = entries[0]

    protocol = str(info.get("protocol") or "")
    direct = info.get("url")
    progressive = bool(direct) and protocol.startswith("http") and "m3u8" not in protocol
    return {
        "title": info.get("title") or "media",
        "direct": direct,
        "headers": info.get("http_headers") or {},
        "ext": "mp3" if audio else (info.get("ext") or "mp4"),
        "progressive": progressive and not audio,
    }


def _authorized(request: Request) -> bool:
    if not API_KEY:
        return True
    return request.headers.get("authorization", "") == f"Api-Key {API_KEY}"


@app.get("/health")
@app.get("/")
def health(request: Request) -> JSONResponse:
    # `auth` reports whether a cookie jar was loaded at boot (no contents), so a
    # misconfigured cookie source can be diagnosed without shipping secrets.
    out: dict[str, Any] = {"status": "ok", "auth": bool(COOKIEFILE), "proxy": bool(PROXY)}
    # `?geo=1` reports the effective egress region (through the proxy if set), so
    # a source that geo-restricts by client IP can be diagnosed.
    if request.query_params.get("geo"):
        proxies = {"http": PROXY, "https": PROXY} if PROXY else None
        try:
            r = requests.get("https://ipinfo.io/json", timeout=10, proxies=proxies)
            j = r.json()
            out["geo"] = {k: j.get(k) for k in ("ip", "city", "region", "country")}
        except Exception as exc:
            out["geo"] = f"lookup failed: {type(exc).__name__}"
    return JSONResponse(out)


@app.post("/")
async def resolve(request: Request) -> JSONResponse:
    if not _authorized(request):
        return JSONResponse({"status": "error", "error": {"code": "auth"}}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        body = {}

    url = (body or {}).get("url")
    if not url or not isinstance(url, str):
        return JSONResponse({"status": "error", "error": {"code": "link.invalid"}})

    audio = (body or {}).get("downloadMode") == "audio"
    quality = (body or {}).get("videoQuality")

    meta = _extract(url, audio, quality)
    if not meta or (not meta["direct"] and not meta["progressive"] and not audio):
        # Nothing resolvable here — let the caller fall through to its next path.
        err: dict[str, Any] = {"status": "error", "error": {"code": "fetch.empty"}}
        if (body or {}).get("debug") and _LAST_ERR:
            err["detail"] = _LAST_ERR
        return JSONResponse(err)

    token = _sign({"u": url, "a": 1 if audio else 0, "q": quality or ""})
    return JSONResponse(
        {
            "status": "tunnel",
            "url": f"{_public_base(request)}/t?d={token}",
            "filename": _safe_name(meta["title"], meta["ext"]),
        }
    )


_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
}


def _pipe(url: str, audio: bool, quality: Optional[str]):
    """Fallback for audio / non-progressive (HLS/DASH) media: let yt-dlp fetch,
    remux, and write to stdout. No Range (single 200 response)."""
    fmt = _format_for(audio, quality)
    cmd = ["yt-dlp", "-f", fmt, "-o", "-", "--no-playlist", "--quiet"]
    if audio:
        cmd += ["-x", "--audio-format", "mp3"]
    else:
        cmd += ["--remux-video", "mp4"]
    if COOKIEFILE:
        cmd += ["--cookies", COOKIEFILE]
    if PROXY:
        cmd += ["--proxy", PROXY]
    if _IMPERSONATE is not None:
        cmd += ["--impersonate", "chrome"]
    cmd.append(url)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            chunk = proc.stdout.read(65536)
            if not chunk:
                break
            yield chunk
    finally:
        proc.stdout.close()
        proc.kill()


@app.get("/t")
def tunnel(d: str, request: Request) -> Any:
    data = _unsign(d)
    if not data:
        return JSONResponse({"error": "bad token"}, status_code=403)

    url = data["u"]
    audio = bool(data.get("a"))
    quality = data.get("q") or None
    meta = _extract(url, audio, quality)
    if not meta:
        return JSONResponse({"error": "resolve failed"}, status_code=502)

    filename = _safe_name(meta["title"], meta["ext"])
    disposition = _disposition(filename)

    # Progressive http(s) video → proxy with Range passthrough (seekable preview).
    # If the CDN rejects this box (signed-URL 403, TLS reset) or the request
    # errors, fall through to the yt-dlp pipe instead of surfacing a 500.
    if meta["progressive"] and meta["direct"]:
        try:
            range_header = request.headers.get("range")
            fwd = dict(meta["headers"])
            if range_header:
                fwd["Range"] = range_header
            proxies = {"http": PROXY, "https": PROXY} if PROXY else None
            upstream = requests.get(
                meta["direct"], headers=fwd, stream=True, timeout=30, proxies=proxies
            )
            if upstream.status_code < 400:
                headers = {
                    **_CORS,
                    "Content-Disposition": disposition,
                    "Content-Type": upstream.headers.get("content-type", "video/mp4"),
                    "Accept-Ranges": "bytes",
                }
                for h in ("content-length", "content-range"):
                    if h in upstream.headers:
                        headers[h.title()] = upstream.headers[h]
                return StreamingResponse(
                    upstream.iter_content(chunk_size=65536),
                    status_code=upstream.status_code,
                    headers=headers,
                )
            upstream.close()
        except Exception:
            pass  # fall through to the pipe path below

    # Audio, or non-progressive video → pipe through yt-dlp.
    ctype = "audio/mpeg" if audio else "video/mp4"
    return StreamingResponse(
        _pipe(url, audio, quality),
        media_type=ctype,
        headers={**_CORS, "Content-Disposition": disposition},
    )
