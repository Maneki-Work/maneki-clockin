/** Helper puri sugli account Web3 (Supabase) — condivisi client/server. */
import type { User } from "@supabase/supabase-js";

/**
 * Indirizzo Solana dell'utente Web3 (null per account email).
 * GoTrue (internal/api/web3.go) annida l'address in custom_claims e usa
 * provider_id "web3:solana:<address>" — vanno provati TUTTI i posti:
 * il primo deploy cercava solo i campi piatti e il server non riconosceva
 * i wallet (bug 29/09: "create a free account" a utenti già loggati).
 */
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function walletAddressOf(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaClaims = (meta.custom_claims ?? {}) as Record<string, unknown>;
  const identity = user.identities?.find((i) => i.provider === "web3");
  const idData = (identity?.identity_data ?? {}) as Record<string, unknown>;
  const idClaims = (idData.custom_claims ?? {}) as Record<string, unknown>;

  // Campi espliciti, in ogni contenitore e con ogni nome plausibile
  // (le versioni GoTrue divergono: il log 29/09 ha custom_claims SENZA
  // "address" — quindi si valida col base58, non ci si fida dei nomi).
  for (const box of [metaClaims, idClaims, meta, idData]) {
    for (const key of ["address", "wallet_address", "public_key", "publicKey"]) {
      const v = box[key];
      if (typeof v === "string" && BASE58_ADDRESS.test(v)) return v;
    }
  }

  // Il subject/provider_id: qualunque formato ("web3:solana:<addr>",
  // "solana:<addr>" o l'address nudo) — l'ultimo segmento deve essere
  // un address base58 valido.
  for (const sub of [idData.sub, meta.sub, identity?.id]) {
    if (typeof sub !== "string") continue;
    const last = sub.split(":").pop() ?? "";
    if (BASE58_ADDRESS.test(last)) return last;
  }
  return null;
}

/** 7xKX…gAsU — formato corto per l'UI. */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Pseudo-email per gli account wallet: la pipeline matching è keyed per
 * email (match_users), un utente Solana non ne ha una. Il dominio riservato
 * la rende riconoscibile ovunque si spedisca davvero (digest, Resend):
 * MAI mandare email a questi indirizzi — filtro con isWalletEmail().
 * Lowercase: upsertMatchUser normalizza comunque, e come chiave la
 * collisione case-insensitive tra due address base58 reali non esiste.
 */
export const WALLET_EMAIL_DOMAIN = "wallet.maneki.work";

export function walletEmailOf(user: User): string | null {
  const address = walletAddressOf(user);
  return address ? `${address.toLowerCase()}@${WALLET_EMAIL_DOMAIN}` : null;
}

export function isWalletEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${WALLET_EMAIL_DOMAIN}`);
}
