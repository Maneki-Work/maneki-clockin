"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { invalidateSavedCache } from "@/lib/saved-jobs-client";
import {
  APP_ROLES,
  APP_LEVELS,
  APP_PLACES,
  loadAppPrefs,
  saveAppPrefs,
  type AppPrefs,
} from "@/lib/app-prefs";
import { loadStreak, type StreakState } from "@/lib/streak";
import { walletAddressOf, shortAddress } from "@/lib/wallet-user";
import { ManekiMark } from "@/components/Logo";
import { signalAppReady } from "@/components/AppSplash";
import SolanaSignInButton from "@/components/SolanaSignInButton";
import { trackEvent } from "@/lib/analytics";

type SkrStatus = { wallet: string | null; balance: number | null; pro: boolean; minRequired: number };

/**
 * PROFILE (v2, redesign gamify 30/09): la tua hunter card in cima — la
 * stessa carta del reveal, editabile in place — poi collare d'oro (SKR),
 * streak e account. Niente link al sito (l'app è l'app), niente Telegram.
 */
export default function AppProfilePage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<AppPrefs>({ roles: [], level: null, places: [], skills: [] });
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [account, setAccount] = useState<{ label: string; isWallet: boolean } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [skr, setSkr] = useState<SkrStatus | null>(null);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [cvOnFile, setCvOnFile] = useState<boolean | null>(null);

  function refreshAccount() {
    supabaseBrowser()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          setAccount(null);
          setSkr(null);
          setCvOnFile(null);
        } else {
          const wallet = walletAddressOf(data.user);
          setAccount(
            data.user.email
              ? { label: data.user.email, isWallet: false }
              : { label: wallet ? shortAddress(wallet) : "Signed in", isWallet: wallet != null },
          );
          fetch("/api/account/skr")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setSkr(d && typeof d.pro === "boolean" ? d : null))
            .catch(() => setSkr(null));
          fetch("/api/match/me").then((r) => setCvOnFile(r.ok)).catch(() => setCvOnFile(false));
        }
        setAuthChecked(true);
      });
  }

  useEffect(() => {
    signalAppReady();
    setPrefs(loadAppPrefs());
    setStreak(loadStreak());
    refreshAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: "roles" | "places", id: string) => {
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(id) ? p[key].filter((x) => x !== id) : [...p[key], id],
    }));
    setDirty(true);
  };

  function save() {
    saveAppPrefs(prefs);
    setDirty(false);
    setEditing(false);
    trackEvent("app_prefs_updated", { roles: prefs.roles.length, level: prefs.level ?? "any", places: prefs.places.length });
    router.push("/app");
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    invalidateSavedCache();
    setAccount(null);
    setSkr(null);
  }

  const roleLabels = prefs.roles
    .map((id) => APP_ROLES.find((r) => r.id === id)?.label)
    .filter(Boolean)
    .join(" · ");
  const cardChips = [
    APP_LEVELS.find((l) => l.id === prefs.level && l.id != null)?.label,
    ...prefs.places.map((id) => APP_PLACES.find((p) => p.id === id)?.label),
  ].filter(Boolean) as string[];

  const pill = (active: boolean) =>
    `border-[1.5px] rounded-full px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider transition-all ${
      active ? "border-accent bg-accent text-accent-fg" : "border-line bg-card text-ink-dim hover:text-ink"
    }`;

  return (
    <main className="max-w-[560px] mx-auto px-4 pt-[calc(28px+env(safe-area-inset-top))] pb-6">
      <h1 className="font-sans text-[22px] font-black tracking-tight mb-5">Your profile</h1>

      {/* HUNTER CARD — la stessa del reveal, editabile */}
      <div className="bg-card border-[1.5px] border-accent rounded-2xl px-5 py-5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] mb-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="mk-beckon"><ManekiMark size={40} /></span>
          <div className="min-w-0 flex-1">
            <div className="font-sans text-[15px] font-extrabold text-ink truncate">
              {roleLabels || "Open to anything"}
            </div>
            <div className="font-mono text-[10px] tracking-wider text-ink-dim">
              {cvOnFile ? "RESUME ON FILE ✓" : "HUNTING BY PREFERENCES"}
            </div>
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className="shrink-0 font-mono text-[10px] font-bold tracking-wider text-accent"
          >
            {editing ? "CLOSE" : "EDIT →"}
          </button>
        </div>
        {!editing && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {cardChips.length > 0 ? (
              cardChips.map((c) => (
                <span key={c} className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                  {c.toUpperCase()}
                </span>
              ))
            ) : (
              <span className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim">
                NO FILTERS — THE WHOLE BOARD
              </span>
            )}
          </div>
        )}

        {editing && (
          <div className="flex flex-col gap-4 mt-1">
            <div>
              <div className="font-mono text-[9px] font-bold tracking-[0.12em] text-ink-dim mb-2">CRAFT</div>
              <div className="flex gap-1.5 flex-wrap">
                {APP_ROLES.map((r) => (
                  <button key={r.id} onClick={() => toggle("roles", r.id)} className={pill(prefs.roles.includes(r.id))}>
                    {r.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] font-bold tracking-[0.12em] text-ink-dim mb-2">EXPERIENCE</div>
              <div className="flex gap-1.5 flex-wrap">
                {APP_LEVELS.filter((l) => l.id != null).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setPrefs((p) => ({ ...p, level: p.level === l.id ? null : l.id })); setDirty(true); }}
                    className={pill(prefs.level === l.id)}
                  >
                    {l.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] font-bold tracking-[0.12em] text-ink-dim mb-2">WHERE</div>
              <div className="flex gap-1.5 flex-wrap">
                {APP_PLACES.filter((p) => p.id != null).map((p) => (
                  <button key={p.id} onClick={() => toggle("places", p.id!)} className={pill(prefs.places.includes(p.id!))}>
                    {p.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {dirty && (
              <button
                onClick={save}
                className="w-full bg-accent text-accent-fg font-mono text-[12px] font-bold tracking-wider py-3.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                SAVE — REFRESH MY HUNT →
              </button>
            )}
          </div>
        )}
      </div>

      {/* COLLARE D'ORO — lo stato SKR */}
      {authChecked && account?.isWallet && (
        <div className={`border-[1.5px] rounded-2xl px-5 py-4 mb-3 bg-card ${skr?.pro ? "border-accent" : "border-line"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim mb-1">
                {skr?.pro ? "✨ GOLDEN COLLAR" : "GOLDEN COLLAR"}
              </div>
              <div className="font-sans text-[14px] font-bold text-ink">
                {skr == null
                  ? "Checking your SKR…"
                  : skr.pro
                    ? "AI Matching active — unlimited swipes"
                    : skr.balance == null
                      ? "Couldn't check your SKR right now"
                      : `Hold ${skr.minRequired.toLocaleString("en-US")}+ SKR to unlock AI Matching`}
              </div>
              {skr?.balance != null && (
                <div className="font-sans text-[12px] text-ink-dim mt-0.5">
                  {skr.balance.toLocaleString("en-US")} SKR in your wallet
                </div>
              )}
            </div>
            {skr?.pro && (
              <Link
                href="/app/match"
                className="shrink-0 font-mono text-[10px] font-bold tracking-wider bg-accent text-accent-fg rounded-xl px-3 py-2"
              >
                DEEP SCAN →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* STREAK — qui vive, non nell'header di caccia */}
      {streak && streak.streak > 0 && (
        <div className="border-[1.5px] border-line bg-card rounded-2xl px-5 py-4 mb-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim mb-1">STREAK</div>
            <div className="font-sans text-[14px] font-bold text-ink">
              Day {streak.streak} 🔥{streak.best > streak.streak ? ` — best ${streak.best}` : ""}
            </div>
            <div className="font-sans text-[12px] text-ink-dim mt-0.5">
              Open the app every day to keep it alive.
            </div>
          </div>
          <div className="font-sans text-[34px] font-black text-accent">{streak.streak}</div>
        </div>
      )}

      {/* ACCOUNT */}
      {!authChecked ? (
        <div className="font-mono text-[10px] tracking-wider text-ink-dim py-4">…</div>
      ) : account ? (
        <div className="border-[1.5px] border-line bg-card rounded-2xl px-5 py-4 mb-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim mb-1">ACCOUNT</div>
            <div className="font-sans text-[14px] font-bold text-ink truncate">{account.label}</div>
            <div className="font-mono text-[9px] tracking-wider text-ink-dim">
              {account.isWallet ? "SOLANA WALLET" : "EMAIL"}
            </div>
          </div>
          <button
            onClick={signOut}
            className="font-mono text-[10px] font-bold tracking-wider text-ink-dim hover:text-ink border border-line rounded-xl px-3 py-2"
          >
            SIGN OUT
          </button>
        </div>
      ) : (
        <div className="border-[1.5px] border-line bg-card rounded-2xl p-5 mb-3">
          <p className="font-sans text-[13px] text-ink-dim mb-3">
            Sign in with your Solana wallet — your card, stars and streak follow you.
          </p>
          <SolanaSignInButton source="app_profile" onSignedIn={refreshAccount} />
        </div>
      )}

      <Link
        href="/app/start"
        className="inline-block font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink py-2"
      >
        REDO ONBOARDING →
      </Link>

      <div className="pt-4 font-mono text-[9px] tracking-wider text-ink-dim opacity-60">
        MANEKI · UPDATED DAILY
      </div>
    </main>
  );
}
