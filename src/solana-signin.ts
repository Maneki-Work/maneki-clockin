"use client";

/**
 * Sign in with Solana (Seeker): Mobile Wallet Adapter → Supabase Web3 auth.
 * Il wallet firma un messaggio SIWS (EIP-4361), Supabase verifica e apre la
 * sessione — il wallet È l'account, niente email. Funziona su Android
 * (Chrome/TWA): MWA parla con i wallet nativi via intent, quindi va lanciato
 * da un gesto utente. Richiede il provider Web3 abilitato sul progetto
 * Supabase (Authentication → Providers → Web3 → Solana).
 */
import type { SolanaWallet } from "@supabase/auth-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

export const SIGNIN_STATEMENT =
  "Sign in to Maneki. Your wallet is your account: saved jobs and preferences follow it on every device.";

/** MWA esiste solo su Android (Seeker incluso). */
export function isMwaCapable(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

/**
 * Apre il wallet via MWA e completa il login Supabase. Import dinamico:
 * l'SDK Solana entra nel bundle solo quando l'utente tocca il bottone.
 */
export async function signInWithSeekerWallet(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const {
      SolanaMobileWalletAdapter,
      createDefaultAddressSelector,
      createDefaultAuthorizationResultCache,
      createDefaultWalletNotFoundHandler,
    } = await import("@solana-mobile/wallet-adapter-mobile");

    const adapter = new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        name: "Maneki",
        uri: "https://www.maneki.work",
        icon: "/icons/icon-512.png",
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      chain: "solana:mainnet",
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });

    // L'adapter MWA implementa signIn() (SIWS), l'interfaccia che auth-js
    // preferisce sul ramo Solana. Il cast serve solo perché auth-js ha
    // COPIATO i tipi wallet-standard invece di importarli (ReadonlyUint8Array
    // vs Uint8Array su un campo che qui non tocchiamo).
    const { error } = await supabaseBrowser().auth.signInWithWeb3({
      chain: "solana",
      statement: SIGNIN_STATEMENT,
      wallet: adapter as unknown as SolanaWallet,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    // L'utente ha chiuso il wallet / nessun wallet MWA installato / rete.
    const message = e instanceof Error ? e.message : "Wallet sign-in failed.";
    return { ok: false, error: message };
  }
}
