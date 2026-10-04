"use client";

/**
 * Sign in with Solana (Seeker): Mobile Wallet Adapter → Supabase Web3 auth.
 * Il wallet firma un messaggio SIWS (EIP-4361), Supabase verifica e apre la
 * sessione — il wallet È l'account, niente email. Funziona su Android
 * (Chrome/TWA): MWA parla con i wallet nativi via intent, quindi va lanciato
 * da un gesto utente. Richiede il provider Web3 abilitato sul progetto
 * Supabase E l'origin nella lista Redirect URLs (il dominio del messaggio
 * firmato viene validato server-side).
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
 * Provider iniettato (window.solana / window.phantom.solana): presente nei
 * browser in-app dei wallet (Phantom, Solflare…) e con le estensioni
 * desktop. Preferito a MWA quando c'è: zero intent, zero associazione —
 * e su telefoni dove il wallet non risponde agli intent MWA (Phantom fuori
 * dal Seeker) è l'unica strada che funziona.
 */
type InjectedProvider = SolanaWallet & { connect?: () => Promise<unknown> };

function injectedWallet(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: InjectedProvider };
    solana?: InjectedProvider;
  };
  const provider = w.phantom?.solana ?? w.solana ?? null;
  if (!provider) return null;
  const hasApi =
    typeof provider.signIn === "function" || typeof provider.signMessage === "function";
  return hasApi ? provider : null;
}

/** Il bottone si mostra dove un sign-in wallet può riuscire. */
export function canWalletSignIn(): boolean {
  return injectedWallet() != null || isMwaCapable();
}

type MwaModule = typeof import("@solana-mobile/wallet-adapter-mobile");
let mwaModule: Promise<MwaModule> | null = null;

/**
 * Scarica l'SDK PRIMA del tap (chiamato al mount del bottone): l'intent
 * verso il wallet deve partire dentro la finestra del gesto utente — se il
 * click aspetta un download su rete mobile, Chrome lo blocca.
 */
export function preloadMwa(): Promise<MwaModule> {
  if (!mwaModule) mwaModule = import("@solana-mobile/wallet-adapter-mobile");
  return mwaModule;
}

/** Adapter MWA pronto all'uso (riusato anche dal pagamento boost dei gig). */
export async function createMwaAdapter() {
  return buildAdapter(await preloadMwa());
}

function buildAdapter(mod: MwaModule) {
  return new mod.SolanaMobileWalletAdapter({
    addressSelector: mod.createDefaultAddressSelector(),
    appIdentity: {
      name: "Maneki",
      // Origin corrente, MAI hardcoded: sul preview Vercel un uri diverso
      // dall'origin fa rifiutare l'associazione ad alcuni wallet.
      uri: window.location.origin,
      icon: "/icons/icon-512.png",
    },
    authorizationResultCache: mod.createDefaultAuthorizationResultCache(),
    chain: "solana:mainnet",
    onWalletNotFound: mod.createDefaultWalletNotFoundHandler(),
  });
}

/**
 * Apre il wallet via MWA e completa il login Supabase.
 * Primo tentativo: signIn() SIWS (un solo round-trip). Se il wallet non
 * supporta SIWS via MWA (es. "no sign in result returned by wallet"),
 * fallback: authorize + signMessage — auth-js costruisce lo stesso
 * messaggio EIP-4361 e lo fa firmare come bytes.
 */
export async function signInWithSeekerWallet(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = supabaseBrowser();

    // 1) Provider iniettato (browser in-app del wallet, estensione desktop).
    const injected = injectedWallet();
    if (injected) {
      if (typeof injected.signIn !== "function" && injected.connect) {
        await injected.connect(); // il ramo signMessage vuole il wallet già connesso
      }
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: SIGNIN_STATEMENT,
        wallet: injected,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    // 2) MWA (Android): intent verso il wallet nativo.
    const mod = await preloadMwa();
    const adapter = buildAdapter(mod);

    try {
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: SIGNIN_STATEMENT,
        // Cast: auth-js ha COPIATO i tipi wallet-standard invece di
        // importarli (ReadonlyUint8Array vs Uint8Array, campo mai toccato).
        wallet: adapter as unknown as SolanaWallet,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (siwsError) {
      // Fallback signMessage: facciamo sparire signIn() dal wallet passato
      // ad auth-js, così prende il ramo signMessage + publicKey.toBase58().
      await adapter.connect();
      if (!adapter.publicKey) throw siwsError;
      const facade = {
        publicKey: adapter.publicKey,
        signMessage: (message: Uint8Array) => adapter.signMessage(message),
      };
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: SIGNIN_STATEMENT,
        wallet: facade as unknown as SolanaWallet,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
  } catch (e) {
    // L'utente ha chiuso il wallet / nessun wallet MWA / associazione fallita.
    const message =
      e instanceof Error ? `${e.name}: ${e.message}` : "Wallet sign-in failed.";
    return { ok: false, error: message };
  }
}
