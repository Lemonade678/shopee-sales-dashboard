import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { STORE } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: `${STORE.name} · Sales Analytics`,
  description: "Sales analytics & time-series forecasting for your Shopee store",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-lg">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
              <Link href="/" className="group flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg shadow-sm shadow-brand-500/30">
                  {STORE.emoji}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-base font-bold tracking-tight text-slate-900">
                    {STORE.name}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">{STORE.tagline}</span>
                </span>
              </Link>
              <nav className="flex items-center gap-1 text-sm font-medium">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/insights"
                  className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  AI Insights
                </Link>
                <Link
                  href="/import"
                  className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Import
                </Link>
                <a
                  href={STORE.shopUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 rounded-lg bg-brand-500 px-3 py-2 text-white shadow-sm transition hover:bg-brand-600"
                >
                  View store ↗
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
          <footer className="mx-auto max-w-7xl px-6 pb-10 pt-4 text-center text-xs text-slate-400">
            {STORE.name} · powered by Next.js, Supabase & Python analytics
          </footer>
        </div>
      </body>
    </html>
  );
}
