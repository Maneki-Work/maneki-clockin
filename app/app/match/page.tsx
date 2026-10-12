"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { jobSlugId } from "@/lib/job-url";
import { ManekiMark } from "@/components/Logo";
import { signalAppReady } from "@/components/AppSplash";
import SolanaSignInButton from "@/components/SolanaSignInButton";
import { trackEvent } from "@/lib/analytics";
import type { MatchResultItem } from "@/lib/match-contract";

type SkrStatus = { wallet: string | null; balance: number | null; pro: boolean; minRequired: number };

type Phase =
  | { kind: "loading" }
  | { kind: "signedout" }
  | { kind: "locked"; skr: SkrStatus }
  | { kind: "upload"; error?: string }
  | { kind: "scanning"; label: string }
  | { kind: "results"; results: MatchResultItem[]; token: string; computedAt: string | null }
  | { kind: "error"; message: string };

/**
 * AI MATCH — il career agent dell'app Seeker (hackathon CLOCK IN).
 * Tier pro: sbloccato dall'hold SKR (fase B). Il CV viene letto una volta,
 * scartato subito (resta solo il profilo estratto), e i risultati sono
 * giudizi LLM con evidenze — la stessa pipeline del sito, superficie app.
 */
export default function AppMatchPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const fileRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<string | null>(null);

  const runMatch = useCallback(async (token: string, force = false) => {
    tokenRef.current = token;
    setPhase({ kind: "scanning", label: force ? "RESCANNING THE BOARD" : "SCANNING 2,500+ LIVE JOBS" });
    try {
      const res = await fetch("/api/match/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, force }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.results)) {
        setPhase({ kind: "error", message: data?.error ?? "The scan failed. Try again." });
        return;
      }
      trackEvent("app_match_results", { count: data.results.length, cached: data.cached === true });
      setPhase({ kind: "results", results: data.results, token, computedAt: data.computedAt ?? null });
    } catch {
      setPhase({ kind: "error", message: "Network error during the scan. Try again." });
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setPhase({ kind: "loading" });
    const { data } = await supabaseBrowser().auth.getUser();
    if (!data.user) {
      setPhase({ kind: "signedout" });
      return;
    }
    let skr: SkrStatus | null = null;
    try {
      const res = await fetch("/api/account/skr");
      if (res.ok) skr = (await res.json()) as SkrStatus;
    } catch {
      /* trattato come non verificabile */
    }
    if (!skr?.pro) {
      setPhase({ kind: "locked", skr: skr ?? { wallet: null, balance: null, pro: false, minRequired: 1 } });
      return;
    }
    // Pro: profilo match esistente? Se sì dritto ai risultati salvati.
    try {
      const res = await fetch("/api/match/me");
      if (res.ok) {
        const me = await res.json();
        if (typeof me?.token === "string") {
          await runMatch(me.token);
          return;
        }
      }
      setPhase({ kind: "upload" });
    } catch {
      setPhase({ kind: "upload" });
    }
  }, [runMatch]);

  useEffect(() => {
    signalAppReady();
    trackEvent("app_match_shown", {});
    void bootstrap();
  }, [bootstrap]);

  async function uploadCv(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setPhase({ kind: "upload", error: "PDF too large (max 5MB)." });
      return;
    }
    setPhase({ kind: "scanning", label: "READING YOUR RESUME" });
    trackEvent("app_match_upload", {});
    try {
      const form = new FormData();
      form.append("cv", file);
      const res = await fetch("/api/match/start", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        setPhase({ kind: "upload", error: data?.error ?? "Couldn't read that resume. Try another PDF." });
        return;
      }
      await runMatch(data.token, true);
    } catch {
      setPhase({ kind: "upload", error: "Network error during upload. Try again." });
    }
  }

  const heading = (
    <div className="mb-6">
      <h1 className="font-sans text-[24px] font-black tracking-tight leading-tight">AI Match</h1>
      <p className="font-sans text-[13px] text-ink-dim mt-1">
        Your resume, scored against every live job on the board.
      </p>
    </div>
  );

  return (
    <main className="max-w-[560px] mx-auto px-4 pt-[calc(28px+env(safe-area-inset-top))] pb-6">
      {heading}

      {phase.kind === "loading" && (
        <div className="py-16 text-center font-mono text-[11px] font-bold tracking-wider text-ink-dim">…</div>
      )}

      {phase.kind === "signedout" && (
        <div className="flex flex-col gap-2.5">
          <div className="border border-line bg-card rounded-sharp p-5 mb-1">
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent mb-2">SEEKER PRO</div>
            <div className="font-sans text-[16px] font-extrabold tracking-tight mb-1.5">
              Your wallet is the key
            </div>
            <p className="font-sans text-[13px] text-ink-dim">
              Sign in with the wallet on your Seeker. Holding SKR unlocks the AI career agent —
              no subscription, the balance is the membership.
            </p>
          </div>
          <SolanaSignInButton source="app_match" onSignedIn={() => void bootstrap()} />
        </div>
      )}

      {phase.kind === "locked" && (
        <div className="border border-line bg-card rounded-sharp p-5">
          <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim mb-2">
            SEEKER PRO · LOCKED
          </div>
          <div className="font-sans text-[16px] font-extrabold tracking-tight mb-1.5">
            {phase.skr.wallet == null
              ? "AI Match unlocks with your Seeker wallet"
              : `Hold ${phase.skr.minRequired.toLocaleString("en-US")}+ SKR to unlock`}
          </div>
          <p className="font-sans text-[13px] text-ink-dim mb-4">
            {phase.skr.wallet == null
              ? "This account has no wallet. Sign in with Solana from your profile — SKR in the wallet unlocks the AI career agent."
              : phase.skr.balance == null
                ? "We couldn't check your SKR balance right now. Pull to refresh or try again in a minute."
                : `${phase.skr.balance.toLocaleString("en-US")} SKR in your wallet. Top up to ${phase.skr.minRequired.toLocaleString("en-US")} and the agent is yours.`}
          </p>
          <Link
            href="/app/profile"
            className="inline-block font-mono text-[11px] font-bold tracking-wider text-accent"
          >
            GO TO PROFILE →
          </Link>
        </div>
      )}

      {phase.kind === "upload" && (
        <div>
          <div className="border border-line bg-card rounded-sharp p-5 mb-3">
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent mb-2">
              PRO ACTIVE · STEP 1 OF 1
            </div>
            <div className="font-sans text-[16px] font-extrabold tracking-tight mb-1.5">
              Drop your resume, the cat does the rest
            </div>
            <p className="font-sans text-[13px] text-ink-dim">
              One PDF. We extract your profile and discard the file immediately — then every
              live job gets scored against you, with evidence.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCv(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider py-4 rounded-sharp hover:opacity-90 active:scale-[0.99] transition-all"
          >
            UPLOAD MY RESUME (PDF)
          </button>
          {phase.error && (
            <p className="font-sans text-[12px] text-ink-dim mt-2.5 text-center" role="alert">
              {phase.error}
            </p>
          )}
        </div>
      )}

      {phase.kind === "scanning" && (
        <div className="py-14 flex flex-col items-center text-center">
          <span className="mk-beckon mb-5">
            <ManekiMark size={56} />
          </span>
          <div className="font-mono text-[11px] font-bold tracking-[0.14em] text-ink-dim">
            {phase.label}
          </div>
          <p className="font-sans text-[13px] text-ink-dim mt-2 max-w-[280px]">
            Real scoring takes a minute — every match comes with evidence, not vibes.
          </p>
        </div>
      )}

      {phase.kind === "results" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim">
              {phase.results.length} MATCHES
              {phase.computedAt &&
                ` · ${new Date(phase.computedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </div>
            <button
              onClick={() => void runMatch(phase.token, true)}
              className="font-mono text-[10px] font-bold tracking-wider text-accent"
            >
              RESCAN →
            </button>
          </div>
          {phase.results.length === 0 ? (
            <div className="border border-line bg-card rounded-sharp p-5 font-sans text-[13px] text-ink-dim">
              No strong matches right now. The board refreshes nightly — rescan tomorrow, or
              broaden your profile with a new resume below.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {phase.results.map((r) => (
                <Link
                  key={r.id}
                  href={`/app/job/${jobSlugId(r)}`}
                  className="block bg-card border border-line rounded-sharp px-4 py-4 active:bg-line-2 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-[46px] h-[46px] rounded-sharp flex flex-col items-center justify-center ${
                        r.score >= 75 ? "bg-accent text-accent-fg" : "bg-line-2 text-ink"
                      }`}
                    >
                      <span className="font-sans text-[17px] font-black leading-none">{r.score}</span>
                      <span className="font-mono text-[7px] font-bold tracking-wider opacity-80">SCORE</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-sans text-[15px] font-extrabold tracking-tight leading-snug text-ink">
                        {r.title}
                      </div>
                      <div className="font-mono text-[10px] font-bold tracking-wider text-ink-dim mt-1">
                        {r.company.toUpperCase()}
                        {r.salary ? ` · ${r.salary}` : ""}
                      </div>
                      {r.note && (
                        <p className="font-sans text-[12.5px] text-ink-dim mt-1.5 line-clamp-2">{r.note}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCv(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink py-2"
          >
            UPLOAD A NEW RESUME →
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="border border-line bg-card rounded-sharp p-5">
          <div className="font-sans text-[14px] font-bold mb-1.5">Something broke</div>
          <p className="font-sans text-[13px] text-ink-dim mb-4">{phase.message}</p>
          <button
            onClick={() => void bootstrap()}
            className="font-mono text-[11px] font-bold tracking-wider text-accent"
          >
            TRY AGAIN →
          </button>
        </div>
      )}
    </main>
  );
}
