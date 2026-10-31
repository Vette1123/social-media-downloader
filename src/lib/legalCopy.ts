/**
 * The English words of /pro, /privacy, /terms and /account. Part of `pageCopy`,
 * so every language has to match this shape. `{link}` tokens become elements in
 * the page that renders them; see Rich.
 */
export const legalCopy = {
  shared: {
    back: 'Back to the downloader',
    backArrow: '← Back to the downloader',
    lastUpdated: 'Last updated {date}',
    translationNote:
      'This page is a translation for your convenience. If it differs from the {english}, the English version applies.',
    englishVersion: 'English version',
  },
  pro: {
    metaTitle: 'Support Social Media Downloader',
    metaDescription:
      'This downloader is free and stays free. Supporters also get the batch queue, playlist import, subtitle downloads, ZIP bundling and priority resolve.',
    badge: 'Support',
    h1Lead: 'Free forever.',
    h1Accent: 'Not free to run.',
    intro:
      'Every download on this site is free, with no account and no limits, and that is not changing. A membership covers a slice of what it costs to keep the resolvers up — and switches on a few things that save you standing over them.',
    membership: 'Become a supporter',
    membershipPrice: '${monthly}/month · ${yearly}/year',
    lifetime: 'Lifetime',
    lifetimePrice: '${lifetime} once · never renews',
    howItSwitches:
      'Either one switches the extras on by itself, for the address you pay with — no account here needed to pay, and nothing to send me.',
    extrasTitle: 'Supporters get the extras',
    levels:
      'The two levels are {membership} and {lifetime}. Sign in here with the same address you paid with and the extras are already on, usually within minutes. The monthly covers this downloader; the lifetime covers every project I build, including the ones that do not exist yet.',
    oneOff:
      'Prefer {coffee} of any amount? That one is a plain thank-you and switches nothing on by itself. Same if you signed in with a different address — email {email} from the address on your receipt and I’ll sort it by hand, usually the same day.',
    oneOffLink: 'a one-off coffee',
    directTitle: 'And a direct line to me.',
    directBody:
      'Supporters get my number — message me any time, about anything. Ask for a feature and I’ll build it if it can be built. It’s a short list, so that is a real promise rather than a nice sentence.',
    closing:
      'Every one above is about doing the same work without standing over it — a queue instead of one link at a time, a whole run in one archive instead of twenty files, a playlist instead of twenty pastes, and downloads that land named the way you file things. None of them reach anything a visitor without them cannot already download, and none of them involve this site signing in anywhere on your behalf. Everything free today stays free whether anyone supports this or not.',
    tip: 'Supporting this is a tip, not a purchase: no invoice from us and no refund policy, because nothing is being sold. Payments, memberships and cancelling one are handled entirely by Buy Me a Coffee under their own terms. Questions: {email}, answered by {author}.',
  },
  privacy: {
    metaTitle: 'Privacy Policy — Social Media Downloader',
    metaDescription:
      'How {site} handles your data: no sign-up needed, Google sign-in for Pro only, usage analytics, no cross-site tracking.',
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'If you never sign in',
        paragraphs: [
          'No account and no sign-up. Your Recent list is written to your own browser’s local storage and never leaves the device. Usage is measured as described under Analytics below.',
        ],
      },
      {
        heading: 'If you sign in for Pro',
        paragraphs: [
          'Signing in with Google creates an account. We store your email address, your Google account ID, your display name and the link to your Google profile photo, and a list of the sessions (devices/browsers) currently signed in — that list is what lets you sign out of one device from another, and what enforces the 5-device cap. The name and photo are only used to show you who you are signed in as. We do not store a password; Google handles authentication and we never see one.',
          'Your name, email and photo link are also kept in your own browser’s storage, so the account button can render without calling our server on every page. Signing out erases that copy.',
          'We do not store IP addresses. Deleting your account, from {account}, removes your record and every session immediately. Analytics events stay, but nothing links them to you any more.',
        ],
      },
      {
        heading: 'Analytics',
        paragraphs: [
          'We use PostHog to see how the site is used and to catch and fix errors. That covers the pages and buttons used and what is downloaded: the platform, link, title and author. A small sample of visits is recorded as a session replay, with typed text hidden. Events carry a random ID, or your account ID if you are signed in, and never your name or email. It sets no cookies. We also use Cloudflare Web Analytics for page-view counts.',
        ],
      },
      {
        heading: 'Sponsor links',
        paragraphs: [
          'After a successful download we may show one sponsor card. If you click it you are taken to that company’s own site and we may earn a commission on a purchase, at no extra cost to you. We only see that a click happened, reported in aggregate by the advertiser. We never sell your data, and we run no popups, popunders, or redirects.',
        ],
      },
      {
        heading: 'Payments',
        paragraphs: [
          'Nothing is sold on this site, so we take no payments and hold no billing data. If you support the project, that happens entirely on Buy Me a Coffee under their privacy policy — we never see your card details, and the only thing that reaches us is whatever you put in the email asking for the extras to be switched on.',
        ],
      },
      {
        heading: 'Media handling',
        paragraphs: [
          'Links are resolved on demand and nothing you download is stored on our servers. Where a file is proxied, it is streamed through and discarded.',
        ],
      },
      {
        heading: 'Your clipboard',
        paragraphs: [
          'The Paste button reads your clipboard once, when you press it. Supporters can also switch on a setting that reads it when you return to the tab, so a link copied elsewhere resolves by itself. It is off unless you turn it on, your browser asks permission before the first read, and the reading happens in your browser: if the clipboard holds a link, that link is sent to our resolver exactly as though you had pasted it, and if it holds anything else the text is discarded on the spot and never sent anywhere. Nothing is read while the tab is in the background — browsers do not permit it, and neither would we.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Privacy questions, or a request to delete data we hold, go to {email}, read by {author}. You can also delete your account and every session yourself, at any time, from {account}.',
        ],
      },
    ],
  },
  terms: {
    metaTitle: 'Terms of Service — Social Media Downloader',
    metaDescription:
      'The terms for using {site}: as-is service, your responsibility for content rights, and what supporting the project does and does not buy.',
    title: 'Terms of Service',
    notAffiliated: 'not affiliated with, endorsed by, or sponsored by',
    sections: [
      {
        heading: 'Provided as-is',
        paragraphs: [
          '{site} is provided “as is” with no warranty of any kind, express or implied. We do not guarantee uninterrupted access, that every link will resolve, or that any particular platform will keep working.',
        ],
      },
      {
        heading: 'Your responsibility',
        paragraphs: [
          'You are responsible for having the right to download any content you process through this site — your own uploads, content you have permission to save, or material that is otherwise legally yours to download. We do not host or vet the media you link to.',
        ],
      },
      {
        heading: 'No commercial redistribution',
        paragraphs: [
          'Downloaded media is for personal use. You may not resell, re-upload for profit, or otherwise commercially redistribute content you did not create or license.',
        ],
      },
      {
        heading: 'What this site will not do',
        paragraphs: [
          '{site} reaches only what is already publicly accessible. It does not bypass DRM, defeat a paywall, sign in on your behalf, or reach private accounts, subscriber-only posts, or anything else a platform serves only to a logged-in viewer. Supporting the project does not change this: what supporters get affects how work is queued and how results are packaged, never what a link can reach.',
          'Using this site to infringe copyright, or to access material you have no right to, is a breach of these terms. We may refuse service or close an account for it.',
        ],
      },
      {
        heading: 'Trademarks and affiliation',
        paragraphs: [
          '{site} is an independent tool and is {notAffiliated} TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit, Threads, Snapchat, Twitch, Vimeo, or any other platform named on this site. Those names and logos belong to their respective owners and are used only to describe which links this tool accepts.',
        ],
      },
      {
        heading: 'Rights holders',
        paragraphs: [
          'We do not host, store, or index media. Files are fetched from the source platform at the moment you ask for them and are never kept on our servers, so there is nothing here to take down. If you believe this service is being used to infringe your rights, email {email} and we will respond.',
        ],
      },
      {
        heading: 'Supporting this project',
        paragraphs: [
          'Nothing on {site} is for sale. There is no subscription, no plan, and no charge of any kind — if you are ever billed by something claiming to be this site, it is not us, and we would like to hear about it.',
          'You can support the project voluntarily through Buy Me a Coffee. That is a donation, handled entirely by them under their own terms: it is one-off, it does not renew, and there is nothing here to cancel. As a thank-you we switch some conveniences on for your account — a batch queue, ZIP bundling for a run, priority resolve, custom file names, and no sponsor card — by hand, after you email us.',
          'Those conveniences are a gift and not a purchased entitlement. We may change or withdraw them at any time, and because no sale takes place there is nothing to refund. None of them change what a link can reach; see above.',
          'If you want a donation reversed, that is between you and Buy Me a Coffee, though emailing {email} first is usually faster.',
        ],
      },
      {
        heading: 'Changes to the service',
        paragraphs: [
          'The service may change, be limited, or be discontinued at any time without notice.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Support requests and takedown notices both go to {email}, read by {author}.',
        ],
      },
    ],
  },
  account: {
    metaTitle: 'Your Account — Social Media Downloader',
    badge: 'Account',
    h1Lead: 'Your plan.',
    h1Accent: 'Your call.',
    intro:
      'Manage your subscription, your download preferences, and the devices signed in to this account.',
  },
}
