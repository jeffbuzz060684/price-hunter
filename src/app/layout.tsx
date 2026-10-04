/**
 * LAYOUT racine — PWA installable (manifest + service worker + theme-color).
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Price Hunter",
    template: "%s · Price Hunter"
  },
  description:
    "Comparateur de prix honnête : prix réellement payable, vérifié, jamais simulé.",
  manifest: "/manifest.webmanifest",
  applicationName: "Price Hunter"
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1
};

const swRegister = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){/* offline non critique */})})}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-2 font-bold text-green-700">
              <span aria-hidden>🎯</span> Price Hunter
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/search" className="text-slate-600 hover:text-slate-900">
                Rechercher
              </a>
              <a href="/alerts" className="text-slate-600 hover:text-slate-900">
                Mes alertes
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        <footer className="mt-10 border-t border-slate-200 bg-white py-4">
          <p className="mx-auto max-w-4xl px-4 text-xs text-slate-500">
            Price Hunter n&apos;invente jamais un prix : chaque montant affiché
            provient d&apos;une source vérifiée. Source indisponible = prix non
            vérifiable, affiché comme tel.
          </p>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </body>
    </html>
  );
}
