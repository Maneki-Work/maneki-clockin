"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ManekiMark } from "@/components/Logo";

/**
 * Tab bar dell'app /app — sempre visibile: /app È l'app, in TWA come nel
 * browser. 4 tab (30/09): MANEKI (caccia jobs), COMPANIES (caccia alle
 * aziende, follow), SAVED, PROFILE. BOARD resta pagina raggiungibile
 * dagli stati finali della caccia (con la lente per la search).
 */
const TABS = [
  {
    href: "/app",
    label: "MANEKI",
    match: (p: string) => p === "/app" || p.startsWith("/app/job") || p.startsWith("/app/match") || p.startsWith("/app/board") || p.startsWith("/app/search"),
    icon: <ManekiMark size={24} />,
  },
  {
    // Tab dedicato (scelta utente 30/09): le companies sono una categoria
    // di prima classe, non un toggle dentro la caccia.
    href: "/app/companies",
    label: "COMPANIES",
    match: (p: string) => p.startsWith("/app/companies"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 21V5l7-3v19M11 21h9V9l-6-2" />
        <path d="M7 9h.01M7 13h.01M7 17h.01M16 13h.01M16 17h.01" />
      </svg>
    ),
  },
  {
    href: "/app/saved",
    label: "SAVED",
    match: (p: string) => p.startsWith("/app/saved"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 17.3 5.8 21l1.6-7L2 9.3l7.1-.6L12 2l2.9 6.7 7.1.6-5.4 4.7 1.6 7z" />
      </svg>
    ),
  },
  {
    href: "/app/profile",
    label: "PROFILE",
    match: (p: string) => p.startsWith("/app/profile"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
] as const;

export default function AppTabBar() {
  const pathname = usePathname();

  // Sul dettaglio job la barra resta: back = tab MANEKI attiva, coerente.
  return (
    <nav
      aria-label="App navigation"
      className="fixed bottom-0 inset-x-0 z-40 flex border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors ${
              active ? "text-accent" : "text-ink-dim hover:text-ink"
            }`}
          >
            <span className="h-[24px] flex items-center">{t.icon}</span>
            <span className="font-mono text-[9px] font-bold tracking-[0.12em]">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
