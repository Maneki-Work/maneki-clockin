"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, Job, JOB_CARD_COLUMNS } from "@/lib/supabase";
import {
  loadAppPrefs,
  isOnboarded,
  prefsChips,
  applyPrefsToQuery,
  type AppPrefs,
} from "@/lib/app-prefs";
import { ManekiMark } from "@/components/Logo";
import { signalAppReady } from "@/components/AppSplash";
import AppJobCard from "@/components/app/AppJobCard";

const PAGE = 30;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Up late hunting?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * BOARD — il feed personale completo, per chi vuole scavare a mano oltre
 * le prede del giorno (pivot 29/09: la home è la scena del gatto in /app).
 * Primo avvio senza prefs → /app/start.
 */
export default function AppBoardPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<AppPrefs | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [freshWeek, setFreshWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [netError, setNetError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Gate onboarding + carica prefs (solo client: localStorage)
  useEffect(() => {
    if (!isOnboarded()) {
      router.replace("/app/start");
      return;
    }
    setPrefs(loadAppPrefs());
  }, [router]);

  // Prima pagina + conteggi
  useEffect(() => {
    if (!prefs) return;
    let cancelled = false;
    setLoading(true);
    const base = () =>
      applyPrefsToQuery(
        supabase.from("jobs").select(JOB_CARD_COLUMNS, { count: "exact" }).eq("active", true),
        prefs,
      );
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    Promise.all([
      base().order("posted_at", { ascending: false, nullsFirst: false }).range(0, PAGE - 1),
      applyPrefsToQuery(
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("active", true),
        prefs,
      ).gte("posted_at", weekAgo),
    ])
      .then(([first, fresh]) => {
        if (cancelled) return;
        if (first.error || !first.data) {
          // Rete assente o API giù: stato esplicito con retry, non un
          // FETCHING infinito (bug 27/09).
          setNetError(true);
          setLoading(false);
          signalAppReady();
          return;
        }
        setNetError(false);
        setJobs(first.data as Job[]);
        setTotal(first.count ?? first.data.length);
        setHasMore((first.count ?? 0) > first.data.length);
        setFreshWeek(fresh.count ?? null);
        setLoading(false);
        signalAppReady();
      })
      .catch(() => {
        if (cancelled) return;
        setNetError(true);
        setLoading(false);
        signalAppReady();
      });
    return () => {
      cancelled = true;
    };
  }, [prefs, attempt]);

  // Torna la rete → riprova da solo.
  useEffect(() => {
    if (!netError) return;
    const retry = () => setAttempt((a) => a + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [netError]);

  async function loadMore() {
    if (loadingMore || !hasMore || !prefs) return;
    setLoadingMore(true);
    const { data, error } = await applyPrefsToQuery(
      supabase.from("jobs").select(JOB_CARD_COLUMNS).eq("active", true),
      prefs,
    )
      .order("posted_at", { ascending: false, nullsFirst: false })
      .range(jobs.length, jobs.length + PAGE - 1);
    if (!error && data) {
      setJobs((prev) => [...prev, ...(data as Job[])]);
      setHasMore((total ?? 0) > jobs.length + data.length);
    }
    setLoadingMore(false);
  }

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "700px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, jobs.length]);

  const chips = prefs ? prefsChips(prefs) : [];

  return (
    <main className="max-w-[560px] mx-auto px-4 pt-[calc(28px+env(safe-area-inset-top))]">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        <ManekiMark size={28} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim">
            {greeting().toUpperCase()}
          </div>
          <h1 className="font-sans text-[20px] font-black tracking-tight leading-tight">
            The board
          </h1>
          <p className="font-sans text-[11.5px] text-ink-dim mt-0.5">
            Every job in your grounds — beyond today's hunt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {freshWeek != null && freshWeek > 0 && (
            <div className="text-right">
              <div className="font-sans text-[20px] font-black text-accent leading-none">
                +{freshWeek.toLocaleString("en-US")}
              </div>
              <div className="font-mono text-[9px] font-bold tracking-wider text-ink-dim">
                THIS WEEK
              </div>
            </div>
          )}
          {/* La ricerca vive qui dal taglio a 4 tab (29/09) */}
          <Link
            href="/app/search"
            aria-label="Search jobs"
            className="w-[40px] h-[40px] rounded-sharp border border-line bg-card flex items-center justify-center text-ink-dim hover:text-ink hover:border-ink transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Prefs chips + edit */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {chips.length > 0 ? (
          chips.map((c) => (
            <span
              key={c}
              className="border border-line bg-card rounded-sharp px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-ink"
            >
              {c.toUpperCase()}
            </span>
          ))
        ) : (
          <span className="font-mono text-[10px] font-bold tracking-wider text-ink-dim">
            ALL WEB3 ROLES
          </span>
        )}
        <Link
          href="/app/profile"
          className="font-mono text-[10px] font-bold tracking-wider text-accent hover:opacity-80"
        >
          EDIT →
        </Link>
        {total != null && (
          <span className="ml-auto font-mono text-[10px] font-bold tracking-wider text-ink-dim">
            {total.toLocaleString("en-US")} OPEN
          </span>
        )}
      </div>

      {/* Feed */}
      {netError ? (
        <div className="border border-line bg-card rounded-sharp px-5 py-14 text-center">
          <span className="inline-block opacity-40 mb-4">
            <ManekiMark size={44} />
          </span>
          <div className="font-sans text-[16px] font-extrabold mb-1.5">
            The cat can&apos;t reach the internet
          </div>
          <p className="font-sans text-[13px] text-ink-dim mb-5 max-w-[280px] mx-auto">
            Check your connection — this retries by itself the moment you&apos;re back online.
          </p>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="bg-accent text-accent-fg font-mono text-[12px] font-bold tracking-wider px-6 py-3 rounded-sharp hover:opacity-90 transition-opacity"
          >
            TRY AGAIN →
          </button>
        </div>
      ) : loading ? (
        <div className="py-16 text-center">
          <span className="mk-beckon inline-block mb-3">
            <ManekiMark size={40} />
          </span>
          <div className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-dim">
            FETCHING YOUR JOBS
            <span className="mk-thinkdot">.</span>
            <span className="mk-thinkdot">.</span>
            <span className="mk-thinkdot">.</span>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="border border-line bg-card rounded-sharp px-5 py-14 text-center">
          <div className="font-sans text-[16px] font-extrabold mb-1.5">Nothing yet — too narrow?</div>
          <p className="font-sans text-[13px] text-ink-dim mb-5">
            The cat found no roles for this exact mix. Widen a preference and retry.
          </p>
          <Link
            href="/app/profile"
            className="inline-block bg-accent text-accent-fg font-mono text-[12px] font-bold tracking-wider px-6 py-3 rounded-sharp"
          >
            ADJUST MY FEED →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {jobs.map((j) => (
            <AppJobCard key={j.id} job={j} />
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden />}
      {loadingMore && (
        <div className="py-5 text-center font-mono text-[10px] font-bold tracking-wider text-ink-dim">
          LOADING MORE…
        </div>
      )}
      {!loading && !hasMore && jobs.length > 0 && (
        <div className="py-8 text-center font-mono text-[10px] font-bold tracking-wider text-ink-dim">
          THAT&apos;S ALL FOR NOW — NEW ROLES DROP DAILY 🐾
        </div>
      )}
    </main>
  );
}
