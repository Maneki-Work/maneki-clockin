import type { Metadata, Viewport } from "next";
import AppTabBar from "@/components/app/AppTabBar";
import AppSplash from "@/components/AppSplash";
import AppThemeSync from "@/components/app/AppThemeSync";
import AppServiceWorker from "@/components/app/AppServiceWorker";

/**
 * Shell dell'app mobile (/app/*): esperienza disegnata da zero per il
 * job seeker che ha fatto l'onboarding — NON il sito wrappato (direzione
 * utente 26/09 sera). Stessa base: dominio, Supabase, componenti dati.
 * La TWA Seeker punta qui (startUrl /app); nel browser è la demo 1:1.
 * Niente Header/Footer del sito, tab bar propria, noindex totale.
 */
export const metadata: Metadata = {
  title: { default: "Maneki", template: "%s · Maneki" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F12" },
  ],
};

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg text-ink min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))]">
      {children}
      <AppTabBar />
      <AppSplash />
      <AppThemeSync />
      <AppServiceWorker />
    </div>
  );
}
