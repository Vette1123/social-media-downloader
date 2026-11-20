import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Turbopack refuses a source file that is not UTF-8 ("failed to convert rope
// into string") and only says so in the deploy build. A Windows-1252 byte from
// a patch apply shipped that way on 2026-11-20.
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.(tsx?|mjs|json|css)$/.test(e.name) ? [path] : [];
  });
}

describe("source encoding", () => {
  it("every file under src/ is valid UTF-8", () => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const bad = sources(join(__dirname, "..")).filter((file) => {
      try {
        decoder.decode(readFileSync(file));
        return false;
      } catch {
        return true;
      }
    });
    expect(bad).toEqual([]);
  });
});
