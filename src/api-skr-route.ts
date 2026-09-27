/**
 * Stato Seeker Pro dell'utente loggato:
 *   GET → { wallet, balance, pro, minRequired }
 * wallet null = account email (niente SKR check possibile).
 * balance null = RPC irraggiungibile (l'UI non deve punire l'utente).
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-auth";
import { walletAddressOf } from "@/lib/wallet-user";
import { getSkrBalance, isSeekerPro, SKR_PRO_MIN } from "@/lib/skr";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const wallet = walletAddressOf(data.user);
  if (!wallet) {
    return NextResponse.json({ wallet: null, balance: null, pro: false, minRequired: SKR_PRO_MIN });
  }

  const balance = await getSkrBalance(wallet);
  return NextResponse.json({
    wallet,
    balance,
    pro: isSeekerPro(balance),
    minRequired: SKR_PRO_MIN,
  });
}
