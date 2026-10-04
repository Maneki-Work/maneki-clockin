"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  APP_ROLES,
  APP_LEVELS,
  APP_PLACES,
  saveAppPrefs,
  applyPrefsToQuery,
} from "@/lib/app-prefs";
import { earnKoban } from "@/lib/streak";
import { canWalletSignIn } from "@/lib/solana-signin";
import { ManekiMark } from "@/components/Logo";
import { signalAppReady } from "@/components/AppSplash";
import { trackEvent } from "@/lib/analytics";
import { supabaseBrowser } from "@/lib/supabase-browser";
import SolanaSignInButton from "@/components/SolanaSignInButton";

/**
 * Onboarding (v3, feedback design 30/09): login SOLO Solana e obbligatorio
 * (il wallet è l'account, e a fine giro il saldo SKR decide il verdetto
 * AI Matching), multi-selezione su mestieri e territori, niente step
 * skills, niente skip. Chiusura: la tua hunter card + conteggio prede +
 * verdetto SKR (eligible → AI Matching incluso; no → spiegazione).
 */

type Step = "auth" | "role" | "level" | "place" | "cv" | "reveal";
const DOT_STEPS: Step[] = ["role", "level", "place", "cv"];

export default function AppStartPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("auth");
  const [walletCapable, setWalletCapable] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvDone, setCvDone] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  // Verdetto SKR sul reveal: null = check in corso
  const [golden, setGolden] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    signalAppReady();
    trackEvent("app_onboarding_shown", { surface: "app_start" });
    setWalletCapable(canWalletSignIn());
    // Già loggato (redo onboarding, rientro): dritto alle domande.
    supabaseBrowser().auth.getUser().then(({ data }) => {
      if (data.user) setStep((s) => (s === "auth" ? "role" : s));
    });
  }, []);

  useEffect(() => {
    if (step !== "reveal") return;
    applyPrefsToQuery(
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("active", true),
      { roles, level, places },
    ).then(({ count }) => setMatchCount(count ?? null));
    fetch("/api/account/skr")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGolden(d?.pro === true))
      .catch(() => setGolden(false));
  }, [step, roles, level, places]);

  function begin() {
    saveAppPrefs({ roles, level, places, skills: [] });
    trackEvent("app_onboarding_done", {
      roles: roles.length, level: level ?? "any", places: places.length,
      cv: cvDone, golden: golden === true,
    });
    router.replace("/app");
  }

  async function uploadCv(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setCvError("PDF too large (max 5MB).");
      return;
    }
    setCvBusy(true);
    setCvError(null);
    trackEvent("app_cv_fed", { source: "onboarding" });
    try {
      const form = new FormData();
      form.append("cv", file);
      const res = await fetch("/api/match/start", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        setCvError(data?.error ?? "Couldn't read that PDF. Try another.");
        setCvBusy(false);
        return;
      }
      earnKoban(5);
      setCvDone(true);
      setCvBusy(false);
      setTimeout(() => setStep("reveal"), 900);
    } catch {
      setCvError("Network hiccup. Try again.");
      setCvBusy(false);
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const MultiChip = ({ active, onClick, label, blurb }: { active: boolean; onClick: () => void; label: string; blurb: string }) => (
    <button
      onClick={onClick}
      className={`w-full border-[1.5px] px-4 py-3.5 rounded-sharp text-left transition-all min-h-[60px] ${
        active
          ? "border-accent bg-accent text-accent-fg scale-[1.01]"
          : "border-line bg-card text-ink hover:border-ink active:scale-[0.99]"
      }`}
    >
      <span className="block font-sans text-[15px] font-bold">{label}</span>
      <span className={`block font-sans text-[12px] mt-0.5 ${active ? "opacity-80" : "text-ink-dim"}`}>{blurb}</span>
    </button>
  );

  const header = (title: string, sub: string) => (
    <>
      <h1 className="font-sans text-[28px] font-black tracking-tight leading-tight mb-2">{title}</h1>
      <p className="font-sans text-[14px] text-ink-dim mb-6">{sub}</p>
    </>
  );

  const nextBtn = (label: string, onClick: () => void) => (
    <div className="mt-auto pt-6">
      <button
        onClick={onClick}
        className="w-full bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider py-4 rounded-sharp hover:opacity-90 active:scale-[0.99] transition-all"
      >
        {label}
      </button>
    </div>
  );

  const dotIndex = DOT_STEPS.indexOf(step);
  const BACK_MAP: Partial<Record<Step, Step>> = {
    level: "role",
    place: "level",
    cv: "place",
    reveal: "cv",
  };
  const backTo = BACK_MAP[step];

  return (
    <main className="max-w-[480px] mx-auto px-6 pt-[calc(20px+env(safe-area-inset-top))] pb-6 min-h-[calc(100dvh-80px)] flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        {backTo && (
          <button
            onClick={() => setStep(backTo)}
            aria-label="Back"
            className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-ink-dim hover:text-ink text-[18px]"
          >
            ←
          </button>
        )}
        <ManekiMark size={30} />
      </div>
      {dotIndex >= 0 && (
        <div className="flex items-center gap-1.5 mb-8">
          {DOT_STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full transition-all ${i <= dotIndex ? "bg-accent w-7" : "bg-line w-4"}`} />
          ))}
        </div>
      )}

      {step === "auth" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="mk-beckon mb-5">
              <ManekiMark size={72} />
            </span>
            <h1 className="font-sans text-[28px] font-black tracking-tight leading-tight mb-2">
              Meet Maneki.
            </h1>
            <p className="font-sans text-[14px] text-ink-dim max-w-[300px]">
              Job hunting, made a game. Fresh web3 roles brought to you daily —
              swipe, save, apply.
            </p>
          </div>
          <div className="pt-6 flex flex-col gap-2.5">
            <SolanaSignInButton
              source="app_onboarding_auth"
              onSignedIn={() => setStep("role")}
            />
            {!walletCapable && (
              <p className="font-sans text-[12.5px] text-ink-dim text-center px-4">
                Maneki signs you in with your Solana wallet. Open this page on
                your Seeker (or any Android phone with a Solana wallet installed).
              </p>
            )}
          </div>
        </div>
      )}

      {step === "role" && (
        <>
          {header("What do you do?", "Pick one or more — the hunt follows your craft.")}
          <div className="grid grid-cols-2 gap-2.5">
            {APP_ROLES.map((r) => (
              <MultiChip
                key={r.id}
                active={roles.includes(r.id)}
                onClick={() => toggle(roles, setRoles, r.id)}
                label={r.label}
                blurb={r.blurb}
              />
            ))}
          </div>
          {nextBtn(roles.length > 0 ? "NEXT →" : "SHOW ME EVERYTHING →", () => setStep("level"))}
        </>
      )}

      {step === "level" && (
        <>
          {header("Your experience", "Pick the closest — nearby levels stay included.")}
          <div className="flex flex-col gap-2.5">
            {APP_LEVELS.map((l) => (
              <MultiChip
                key={l.label}
                active={l.id != null && level === l.id}
                onClick={() => {
                  setLevel(l.id);
                  setTimeout(() => setStep("place"), 220);
                }}
                label={l.label}
                blurb={l.blurb}
              />
            ))}
          </div>
          {nextBtn("NEXT →", () => setStep("place"))}
        </>
      )}

      {step === "place" && (
        <>
          {header("Where do you work from?", "Pick all that apply — remote counts as a place.")}
          <div className="flex flex-col gap-2.5">
            {APP_PLACES.filter((p) => p.id != null).map((p) => (
              <MultiChip
                key={p.label}
                active={places.includes(p.id!)}
                onClick={() => toggle(places, setPlaces, p.id!)}
                label={p.label}
                blurb={p.blurb}
              />
            ))}
          </div>
          {nextBtn(places.length > 0 ? "NEXT →" : "ANYWHERE WORKS →", () => setStep("cv"))}
        </>
      )}

      {step === "cv" && (
        <>
          {header(
            cvDone ? "Resume locked in ✓" : "Add your resume",
            cvDone
              ? "From here on, every hunt is personal."
              : "One PDF, read once, then discarded. It turns generic listings into your matches.",
          )}
          {!cvDone && (
            <>
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
                disabled={cvBusy}
                className="w-full bg-ink text-bg font-mono text-[13px] font-bold tracking-wider py-4 rounded-sharp hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
              >
                {cvBusy ? "READING…" : "UPLOAD MY RESUME (PDF)"}
              </button>
              {cvError && (
                <p className="font-sans text-[12px] text-ink-dim mt-2.5 text-center" role="alert">{cvError}</p>
              )}
              {nextBtn("LATER →", () => setStep("reveal"))}
            </>
          )}
        </>
      )}

      {step === "reveal" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col justify-center">
            <div className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-dim mb-3 text-center">
              YOUR HUNTER CARD
            </div>
            <div className="bg-card border-[1.5px] border-accent rounded-2xl px-5 py-5 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-3 mb-3">
                <span className="mk-beckon"><ManekiMark size={40} /></span>
                <div>
                  <div className="font-sans text-[15px] font-extrabold text-ink">
                    {roles.length > 0
                      ? roles.map((id) => APP_ROLES.find((r) => r.id === id)?.label).filter(Boolean).join(" · ")
                      : "Open to anything"}
                  </div>
                  <div className="font-mono text-[10px] tracking-wider text-ink-dim">
                    {cvDone ? "RESUME ON FILE ✓" : "HUNTING BY PREFERENCES"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  APP_LEVELS.find((l) => l.id === level && l.id != null)?.label,
                  ...places.map((id) => APP_PLACES.find((p) => p.id === id)?.label),
                ]
                  .filter(Boolean)
                  .map((c) => (
                    <span key={c as string} className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                      {(c as string).toUpperCase()}
                    </span>
                  ))}
              </div>
            </div>

            <div className="text-center mt-6 mb-5">
              <div className="font-mono text-[11px] font-bold tracking-[0.14em] text-ink-dim mb-1.5">THE CAT FOUND</div>
              <div className="font-sans text-[52px] font-black tracking-tight leading-none text-accent">
                {matchCount != null ? matchCount.toLocaleString("en-US") : "…"}
              </div>
              <div className="font-sans text-[15px] font-bold mt-1">jobs in your hunting grounds</div>
            </div>

            {/* Verdetto SKR: il login Solana ci fa leggere il saldo — chi è
                eligible parte con l'AI Matching incluso, chi no lo scopre
                qui (e sa come sbloccarlo). */}
            {golden === true && (
              <div className="border-[1.5px] border-accent bg-card rounded-2xl p-4">
                <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent mb-1">
                  ✨ AI MATCHING UNLOCKED
                </div>
                <p className="font-sans text-[13px] text-ink-dim">
                  SKR found in your wallet — your AI career agent is included.
                  It reads your resume and scores every job for you.
                </p>
              </div>
            )}
            {golden === false && (
              <div className="border-[1.5px] border-line bg-card rounded-2xl p-4">
                <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim mb-1">
                  AI MATCHING RUNS ON SKR
                </div>
                <p className="font-sans text-[13px] text-ink-dim">
                  Hold 1+ SKR in this wallet to unlock the AI career agent —
                  or start hunting free right away. You can add SKR anytime.
                </p>
              </div>
            )}
          </div>
          <div className="pt-5">
            <button
              onClick={begin}
              className="w-full bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider py-4 rounded-sharp hover:opacity-90 active:scale-[0.99] transition-all"
            >
              START THE HUNT →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
