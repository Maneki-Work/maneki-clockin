/** Helper puri sugli account Web3 (Supabase) — condivisi client/server. */
import type { User } from "@supabase/supabase-js";

/** Indirizzo Solana dell'utente Web3 (null per account email). */
export function walletAddressOf(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const claims = (meta.custom_claims ?? {}) as Record<string, unknown>;
  const identity = user.identities?.find((i) => i.provider === "web3");
  const candidate =
    meta.address ?? claims.address ?? identity?.identity_data?.address;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
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
