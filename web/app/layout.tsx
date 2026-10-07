import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import SmoothScroll from "@/components/smooth-scroll";
import "./globals.css";

const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument" });
const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "FwdCheck — Is this forward true?",
  description: "Check WhatsApp forwards against trusted sources. Claim-by-claim verdicts with proof, in your language.",
  manifest: "/manifest.json",
  // iPhone "Add to Home Screen": open full-screen like an app (icon comes from app/apple-icon.png).
  appleWebApp: { capable: true, title: "FwdCheck", statusBarStyle: "default" },
  // Forwards are full of numbers (₹2000, dates); don't let iOS turn them into phone links.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1ece1" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Runs before paint: hide [data-rise] for GSAP, but never longer than 2.5s if scripts fail.
const motionBoot = `if(!matchMedia('(prefers-reduced-motion: reduce)').matches){var d=document.documentElement;d.classList.add('motion');setTimeout(function(){d.classList.remove('motion')},2500)}`;
// Reloading the home page starts at the top. Otherwise a leftover #how (from the nav link) or the browser's
// restored scroll lands mid-page, before the pinned sections have made room, i.e. somewhere random.
const reloadTop = `try{if(location.pathname==='/'){history.scrollRestoration='manual';var n=performance.getEntriesByType('navigation')[0];if(n&&n.type==='reload'&&location.hash)history.replaceState(null,'','/'+location.search)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionBoot + reloadTop }} />
      </head>
      <body className="min-h-dvh">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-[2px]">
          <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-2xl leading-none">FwdCheck</span>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:inline">Forward verification desk</span>
            </Link>
            <div className="flex items-center gap-5 font-mono text-xs uppercase tracking-[0.14em]">
              <Link href="/#how" className="hidden hover:text-signal sm:inline">How it works</Link>
              <Link href="/trending" className="hover:text-signal">Trending</Link>
              <Link href="/#check" className="rounded-full bg-ink px-4 py-2 text-paper transition-colors hover:bg-signal">Check</Link>
            </div>
          </nav>
        </header>
        <SmoothScroll />
        {/* Clip sideways overflow (slide-in animations) here: overflow set on <body> is handed to the viewport and stops clipping. */}
        <div className="overflow-x-clip pt-14">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:justify-between sm:px-8">
            <span>FwdCheck · Is this forward true?</span>
            <span>Every verdict comes with a source</span>
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js')" }} />
      </body>
    </html>
  );
}
