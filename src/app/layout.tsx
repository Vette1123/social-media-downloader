import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { siteConfig } from '@/config/site'
import { globalStructuredData } from '@/lib/structuredData'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

const title = `${siteConfig.name} — ${siteConfig.tagline}`

// Runs synchronously in <head>, before paint. Flags low-power devices and writes
// a .low-power class to <html> so CSS can swap to the cheap variant with no
// flash. Avoids false positives on flagships — only genuine low-end hardware
// (≤4 CPU cores or ≤4GB RAM), Save-Data, or a slow effective network type opts
// down. Everything else keeps the full effect set.
const lowPowerScript = `(function(){try{
var n=navigator,h=hardwareData(n);
if(h.low){document.documentElement.classList.add('low-power');}
}catch(e){}})();function hardwareData(n){var low=false;
try{var cores=n.hardwareConcurrency||8,mem=n.deviceMemory||8;
var slowNet=n.connection&&/2g|slow-2g/.test(n.connection.effectiveType);
var saveData=n.connection&&n.connection.saveData;
low=(cores<=4)||(mem<=4)||!!slowNet||!!saveData;
}catch(e){}return{low:low};}`

export const viewport: Viewport = {
  themeColor: '#08080a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: title,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
  creator: siteConfig.author.name,
  publisher: siteConfig.author.name,
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
    languages: {
      en: '/',
      'x-default': '/',
    },
  },
  openGraph: {
    title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: siteConfig.ogImageAlt,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: siteConfig.description,
    creator: siteConfig.twitterTag,
    site: siteConfig.twitterTag,
    images: [
      {
        url: '/twitter-image',
        alt: siteConfig.ogImageAlt,
        width: 1200,
        height: 630,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
  // Single source of truth for <head>. These used to be declared here AND
  // hand-written as <link> tags below, so every page shipped the manifest and
  // both favicons twice and apple-touch-icon three times. Duplicate icon links
  // are not merely noise: which one a client picks is unspecified, so an iOS
  // home-screen icon could resolve to the SVG, which iOS cannot render.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    // PNG only. `apple-touch-icon` has never supported SVG on iOS — listing
    // /apple-touch-icon.svg gave iOS a candidate it silently drops, leaving a
    // screenshot-of-the-page icon on the home screen instead of the logo.
    apple: [{ url: '/icons/apple', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  verification: {
    google: 'aha64Aa3HDSFKw-xDlfpIGcBkGRU4lRV9xU-qR2SPwc',
  },
  other: {
    'msapplication-TileColor': '#08080a',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' dir='ltr'>
      <head>
        {/* Icons, manifest, tile colour and site verification are all declared
            in `metadata` above — Next renders them into <head> itself. Nothing
            static belongs here; only the two inline scripts, which have no
            Metadata equivalent. */}
        {/* Capability-based rendering: set before first paint so low-power devices
            get the cheap variant with no FOUC. No false positives — flagships and
            tablets keep the full effect set; only genuinely weak hardware (≤4
            cores / ≤4GB RAM), Save-Data, or a slow connection opt down. */}
        <script dangerouslySetInnerHTML={{ __html: lowPowerScript }} />
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(globalStructuredData),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} antialiased`}
        style={{ backgroundColor: '#08080a' }}
      >
        {children}
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ? (
          <script
            defer
            src='https://static.cloudflareinsights.com/beacon.min.js'
            data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_BEACON_TOKEN}"}`}
          />
        ) : null}
      </body>
    </html>
  )
}
