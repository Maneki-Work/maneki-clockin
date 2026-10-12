/**
 * SKR — il token del Solana Seeker. Hold di almeno SKR_PRO_MIN sblocca il
 * tier "Seeker Pro" dell'app (AI matching e i perk futuri). Solo lettura
 * on-chain via RPC JSON: nessuna transazione, il balance è la membership.
 * Mint verificato on-chain (metadata "Seeker"/"SKR", 6 decimali).
 */

export const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";

/** Soglia pro in SKR interi (unità UI, non lamport): default 1. */
export const SKR_PRO_MIN = Number(process.env.SKR_PRO_MIN ?? "1");

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

type ParsedTokenAccount = {
  account?: {
    data?: {
      parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } };
    };
  };
};

/**
 * Balance SKR complessivo di un wallet (somma di tutti i token account).
 * Ritorna null se l'RPC fallisce — chi chiama distingue "0 SKR" da
 * "impossibile verificare": la UI dice "couldn't check" invece di
 * dichiarare zero, ma il pro resta chiuso finché una lettura non riesce
 * (isSeekerPro(null) === false: il gate fallisce chiuso, mai aperto).
 */
export async function getSkrBalance(owner: string): Promise<number | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [owner, { mint: SKR_MINT }, { encoding: "jsonParsed" }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { value?: ParsedTokenAccount[] } };
    const accounts = json.result?.value;
    if (!Array.isArray(accounts)) return null;
    return accounts.reduce(
      (sum, a) => sum + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0),
      0,
    );
  } catch {
    return null;
  }
}

export function isSeekerPro(balance: number | null): boolean {
  return balance != null && balance >= SKR_PRO_MIN;
}
