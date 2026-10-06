import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FwdCheck — Is this forward true?",
  description: "Check WhatsApp forwards against trusted sources. Claim-by-claim verdicts with proof, in your language.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white text-gray-900">
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js')" }} />
      </body>
    </html>
  );
}
