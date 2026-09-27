"use client";

import { useEffect, useState } from "react";
import { isMwaCapable, signInWithSeekerWallet } from "@/lib/solana-signin";
import { invalidateSavedCache } from "@/lib/saved-jobs-client";
import { trackEvent } from "@/lib/analytics";

/** Glifo Solana (i tre tratti) in currentColor. */
function SolanaMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 398 312" fill="currentColor" aria-hidden>
      <path d="M64.6 237.9a13 13 0 0 1 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7a13 13 0 0 1-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7Z" />
      <path d="M64.6 3.8A13 13 0 0 1 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7a13 13 0 0 1-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8Z" />
      <path d="M333.1 120.1a13 13 0 0 0-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7a13 13 0 0 0 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7Z" />
    </svg>
  );
}

/**
 * "Sign in with Solana" via Mobile Wallet Adapter — reso solo dove MWA
 * esiste (Android: Seeker, TWA, Chrome). Su successo la sessione Supabase
 * è già aperta: il chiamante decide dove andare.
 */
export default function SolanaSignInButton({
  source,
  onSignedIn,
}: {
  source: string;
  onSignedIn: () => void;
}) {
  const [capable, setCapable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCapable(isMwaCapable());
  }, []);

  if (!capable) return null;

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    trackEvent("app_wallet_signin_started", { source });
    const result = await signInWithSeekerWallet();
    if (result.ok) {
      invalidateSavedCache(); // i saved jobs sono del nuovo utente
      trackEvent("app_wallet_signin_ok", { source });
      onSignedIn();
    } else {
      trackEvent("app_wallet_signin_failed", { source });
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void connect()}
        disabled={busy}
        className="w-full bg-ink text-bg font-mono text-[13px] font-bold tracking-wider py-4 rounded-sharp hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2.5"
      >
        <SolanaMark size={15} />
        {busy ? "OPENING YOUR WALLET…" : "SIGN IN WITH SOLANA"}
      </button>
      {error && (
        <p className="font-sans text-[12px] text-ink-dim mt-2 text-center" role="alert">
          Wallet sign-in didn&apos;t complete. Try again, or use email below.
        </p>
      )}
    </div>
  );
}
