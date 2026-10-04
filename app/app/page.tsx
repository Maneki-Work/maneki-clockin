"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job } from "@/lib/supabase";
import { isOnboarded } from "@/lib/app-prefs";
import {
  clockInToday, earnKoban, swipesToday, recordSwipe, todayKey, FREE_SWIPES_PER_DAY,
  type StreakState,
} from "@/lib/streak";
import { fetchCatchBatch, recordJudgement, type Judgement } from "@/lib/daily-catch";
import { toggleSaved } from "@/lib/saved-jobs-client";
import { addLocalSave } from "@/lib/local-saves";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ManekiMark } from "@/components/Logo";
import { signalAppReady } from "@/components/AppSplash";
import CatchDeck from "@/components/app/CatchDeck";
import HuntTutorial from "@/components/app/HuntTutorial";
import SolanaSignInButton from "@/components/SolanaSignInButton";
import { trackEvent } from "@/lib/analytics";

/** Il CV si chiede DOPO qualche swipe (valore prima della richiesta). */
const CV_PROMPT_AFTER = 4;
const CV_LATER_PREFIX = "maneki_cv_later:";
/** Tutorial swipe one-shot: visto una volta, mai più (feedback 01/10). */
const HUNT_TUTORIAL_KEY = "maneki_hunt_tutorial";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Up late hunting?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Il gatto sa già chi sei? (profilo match estratto dal CV) */
type ProfileState = "unknown" | "anon" | "none" | "has";

/**
 * MANEKI — la scena del gatto, home dell'app (pivot gamified 29/09).
 * Deck SUBITO (la carta è l'eroe, il gatto si fa piccolo mentre cacci);
 * dopo CV_PROMPT_AFTER swipe il gatto si infila come interstitial a
 * chiedere il CV (rimandabile, torna domani). Cap giornaliero alla
 * Tinder: FREE_SWIPES_PER_DAY, collare d'oro SKR = illimitato.
 */
export default function AppManekiPage() {
  const router = useRouter();
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [queue, setQueue] = useState<Job[] | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [swiped, setSwiped] = useState(0);
  const [golden, setGolden] = useState(false);
  const [likedToday, setLikedToday] = useState(0);
  const [profile, setProfile] = useState<ProfileState>("unknown");
  const [cvPrompt, setCvPrompt] = useState(false);
  const [cvLater, setCvLater] = useState(true); // finché non sappiamo, niente interstitial
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [justFed, setJustFed] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [netError, setNetError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const fetching = useRef(false);

  function checkProfile() {
    supabaseBrowser()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          setProfile("anon");
          return;
        }
        try {
          const [me, skr] = await Promise.all([
            fetch("/api/match/me"),
            fetch("/api/account/skr").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          ]);
          setProfile(me.ok ? "has" : "none");
          setGolden(skr?.pro === true);
        } catch {
          setProfile("none");
        }
      });
  }

  useEffect(() => {
    if (!isOnboarded()) {
      router.replace("/app/start");
      return;
    }
    const { state } = clockInToday();
    setStreak(state);
    setSwiped(swipesToday());
    try {
      setCvLater(localStorage.getItem(CV_LATER_PREFIX + todayKey()) === "1");
    } catch { /* resta true: meglio non assillare */ }
    try {
      setTutorial(localStorage.getItem(HUNT_TUTORIAL_KEY) !== "1");
    } catch { /* senza storage, niente tutorial: tornerebbe a ogni visita */ }
    checkProfile();
  }, [router]);

  // Coda continua: refill quando scende sotto le 4 carte.
  const ensureQueue = useCallback(async (current: Job[]) => {
    if (fetching.current || exhausted) return;
    fetching.current = true;
    try {
      const batch = await fetchCatchBatch(new Set(current.map((j) => j.id)));
      setNetError(false);
      if (batch.length === 0) setExhausted(true);
      else setQueue((q) => {
        const have = new Set((q ?? []).map((j) => j.id));
        return [...(q ?? []), ...batch.filter((j) => !have.has(j.id))];
      });
    } catch {
      if (current.length === 0) setNetError(true);
    } finally {
      fetching.current = false;
      signalAppReady();
    }
  }, [exhausted]);

  useEffect(() => {
    if (!isOnboarded()) return;
    setQueue((q) => q ?? []);
    void ensureQueue([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const capped = !golden && swiped >= FREE_SWIPES_PER_DAY;

  function judge(job: Job, j: Judgement) {
    recordJudgement(job.id, j);
    const n = recordSwipe();
    setSwiped(n);
    trackEvent("app_catch_judged", { verdict: j });
    if (j === "like") {
      setLikedToday((c) => c + 1);
      // Loggato → saved veri; anonimo → stella locale (migra al login).
      toggleSaved(job.id).catch(() => addLocalSave(job.id));
    }
    // L'interstitial CV arriva dopo il gusto dello swipe, mai prima.
    if (!cvLater && n >= CV_PROMPT_AFTER && (profile === "none" || profile === "anon")) {
      setCvPrompt(true);
      trackEvent("app_cv_prompt_shown", {});
    }
    setQueue((q) => {
      const next = (q ?? []).filter((x) => x.id !== job.id);
      if (next.length < 4) void ensureQueue(next);
      return next;
    });
  }

  async function uploadCv(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setCvError("PDF too large (max 5MB).");
      return;
    }
    setCvBusy(true);
    setCvError(null);
    trackEvent("app_cv_fed", { source: "cat_scene" });
    try {
      const form = new FormData();
      form.append("cv", file);
      const res = await fetch("/api/match/start", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        setCvError(data?.error ?? "The cat couldn't read that PDF. Try another.");
        setCvBusy(false);
        return;
      }
      setProfile("has");
      setCvPrompt(false);
      setJustFed(true);
      setStreak(earnKoban(5)); // il gatto ringrazia
    } catch {
      setCvError("Network hiccup. Try again.");
    }
    setCvBusy(false);
  }

  function dismissCv() {
    setCvPrompt(false);
    setCvLater(true);
    try { localStorage.setItem(CV_LATER_PREFIX + todayKey(), "1"); } catch { /* ok */ }
    trackEvent("app_cv_later", {});
  }

  function dismissTutorial() {
    setTutorial(false);
    try { localStorage.setItem(HUNT_TUTORIAL_KEY, "1"); } catch { /* ok */ }
    trackEvent("app_hunt_tutorial_done", {});
  }

  const deckEmpty = queue != null && queue.length === 0 && exhausted;
  const hunting = !cvPrompt && !capped && !netError && queue != null && queue.length > 0;

  // Il tutorial conta come "visto" solo quando il deck è davvero lì sotto.
  useEffect(() => {
    if (hunting && tutorial) trackEvent("app_hunt_tutorial_shown", {});
  }, [hunting, tutorial]);

  const bubble = justFed
    ? "Resume read — the hunt just got personal 😽"
    : cvPrompt
      ? "I hunt better once I’ve read your resume."
      : capped
        ? "Phew… that's all my paws can carry today 😮‍💨"
        : queue == null || (queue.length === 0 && !exhausted)
          ? "Out hunting…"
          : deckEmpty
            ? "You've seen every fresh catch in your grounds ♪"
            : null;

  return (
    <main className="max-w-[480px] mx-auto px-5 pt-[calc(20px+env(safe-area-inset-top))] pb-6">
      {hunting ? (
        /* In caccia: il gatto si fa piccolo, la carta è l'eroe. */
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="mk-beckon shrink-0"><ManekiMark size={30} /></span>
            <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-dim truncate">
              {greeting().toUpperCase()}
            </span>
          </div>
          <div className="font-mono text-[10px] font-bold tracking-wider text-ink-dim shrink-0">
            {golden ? (
              <span className="text-accent">∞ GOLDEN COLLAR</span>
            ) : (
              <>🐾 {Math.max(FREE_SWIPES_PER_DAY - swiped, 0)} SWIPES LEFT</>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3.5 mb-6 mt-3">
            <span className={`${justFed ? "mk-bounce" : "mk-beckon"} shrink-0 mt-1`}>
              <ManekiMark size={60} />
            </span>
            <div className="min-w-0">
              <h1 className="font-sans text-[20px] font-black tracking-tight leading-tight mb-1.5">
                {greeting()}.
              </h1>
              {bubble && (
                <div key={bubble} className="mk-bubble relative bg-card border-[1.5px] border-line rounded-2xl rounded-tl-md px-3.5 py-2.5">
                  <p className="font-sans text-[13.5px] text-ink leading-snug">{bubble}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {netError && (
        <div className="border-[1.5px] border-line bg-card rounded-2xl p-5">
          <p className="font-sans text-[13px] text-ink-dim mb-3">
            The cat came back empty-pawed — network trouble.
          </p>
          <button
            onClick={() => { setNetError(false); setAttempt((a) => a + 1); }}
            className="font-mono text-[11px] font-bold tracking-wider text-accent"
          >
            SEND IT OUT AGAIN →
          </button>
        </div>
      )}

      {/* Interstitial CV: il gatto si infila tra le prede, alla Tinder */}
      {cvPrompt && !capped && !netError && (
        <div className="border-[1.5px] border-accent bg-card rounded-2xl p-5">
          <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent mb-2">
            🐾 LET THE CAT READ YOUR RESUME
          </div>
          <p className="font-sans text-[13.5px] text-ink-dim mb-4">
            One PDF, read once, then discarded. Only your profile stays —
            and the hunt turns personal.
          </p>
          {profile === "anon" ? (
            <div className="flex flex-col gap-2">
              <SolanaSignInButton source="cat_scene_cv" onSignedIn={checkProfile} />
              <p className="font-sans text-[11.5px] text-ink-dim text-center">
                Sign in first, so the cat can remember your profile.
              </p>
            </div>
          ) : (
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
                className="w-full bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider py-4 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
              >
                {cvBusy ? "READING…" : "UPLOAD MY RESUME (PDF)"}
              </button>
              {cvError && (
                <p className="font-sans text-[12px] text-ink-dim mt-2 text-center" role="alert">{cvError}</p>
              )}
            </>
          )}
          <button
            onClick={dismissCv}
            className="mt-2.5 w-full font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink py-1.5"
          >
            KEEP HUNTING →
          </button>
        </div>
      )}

      {/* Gatto stanco: cap giornaliero (solo senza collare d'oro) */}
      {!cvPrompt && capped && !netError && (
        <div className="flex flex-col gap-3">
          <div className="border-[1.5px] border-line bg-card rounded-2xl p-5 text-center">
            <div className="text-[40px] mb-2">😴</div>
            <div className="font-sans text-[16px] font-extrabold tracking-tight mb-1">
              The cat is done for today
            </div>
            <p className="font-sans text-[13px] text-ink-dim">
              {FREE_SWIPES_PER_DAY} catches carried, paws worn out.
              {likedToday > 0 ? ` You starred ${likedToday} — nice haul.` : ""} Fresh
              prey lands every night: come back tomorrow to keep the streak.
            </p>
          </div>
          <Link
            href="/app/profile"
            className="border-[1.5px] border-accent bg-card rounded-2xl p-5 block hover:opacity-90 transition-opacity"
          >
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent mb-1.5">
              ✨ GOLDEN COLLAR
            </div>
            <p className="font-sans text-[13px] text-ink-dim">
              Cats with SKR in their wallet never get tired — unlimited swipes,
              and the deep scan on your resume. Check your collar →
            </p>
          </Link>
          <div className="flex flex-col gap-2">
            <Link href="/app/saved" className="font-mono text-[11px] font-bold tracking-wider text-accent py-1">
              MY STARRED JOBS →
            </Link>
            <Link href="/app/board" className="font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink py-1">
              KEEP BROWSING THE FULL BOARD →
            </Link>
          </div>
        </div>
      )}

      {!cvPrompt && !capped && queue == null && !netError && (
        <div className="py-14 text-center font-mono text-[11px] font-bold tracking-wider text-ink-dim">…</div>
      )}

      {hunting && <CatchDeck jobs={queue!} onJudge={judge} />}
      {hunting && tutorial && <HuntTutorial onDone={dismissTutorial} />}

      {!cvPrompt && !capped && deckEmpty && !netError && (
        <div className="flex flex-col gap-3">
          <div className="border-[1.5px] border-line bg-card rounded-2xl p-5">
            <div className="font-sans text-[16px] font-extrabold tracking-tight mb-1">
              Grounds cleaned out 🏆
            </div>
            <p className="font-sans text-[13px] text-ink-dim">
              You&apos;ve judged every fresh catch that fits you. New prey lands every
              night — or widen your grounds from the profile.
            </p>
          </div>

          {profile === "anon" && likedToday > 0 && (
            <div className="border-[1.5px] border-line bg-card rounded-2xl p-5">
              <p className="font-sans text-[13px] text-ink-dim mb-3">
                Your stars live only on this phone. Sign in and the cat remembers them everywhere.
              </p>
              <SolanaSignInButton source="app_catch_done" onSignedIn={checkProfile} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Link href="/app/saved" className="font-mono text-[11px] font-bold tracking-wider text-accent py-1">
              MY STARRED JOBS →
            </Link>
            <Link href="/app/board" className="font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink py-1">
              DIG THE FULL BOARD YOURSELF →
            </Link>
            <Link href="/app/match" className="font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink py-1">
              GOLDEN COLLAR — THE CAT&apos;S DEEP SCAN →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
