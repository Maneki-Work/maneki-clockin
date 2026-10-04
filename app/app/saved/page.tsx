"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, Job, JOB_CARD_COLUMNS } from "@/lib/supabase";
import { getSavedSet, subscribeSaved } from "@/lib/saved-jobs-client";
import { localSaveIds, migrateLocalSaves } from "@/lib/local-saves";
import AppJobCard from "@/components/app/AppJobCard";
import { signalAppReady } from "@/components/AppSplash";

/**
 * SAVED — la shortlist. Anonimo CON stelle locali (swipe del deck) → le
 * vede comunque, con l'avviso che vivono solo sul telefono; al login
 * migrano sull'account. Anonimo a mani vuote → invito al free account.
 */
export default function AppSavedPage() {
  const [state, setState] = useState<"loading" | "anon" | "local" | "ready">("loading");
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    signalAppReady();
    let alive = true;
    const refresh = () =>
      getSavedSet().then(async (set) => {
        if (!alive) return;
        if (!set) {
          // Anonimo: le stelle del deck vivono in locale — mostrale (fix 29/09).
          const ids = localSaveIds();
          if (ids.length === 0) {
            setState("anon");
            return;
          }
          const { data } = await supabase
            .from("jobs")
            .select(JOB_CARD_COLUMNS)
            .in("id", ids)
            .order("posted_at", { ascending: false, nullsFirst: false });
          if (!alive) return;
          setJobs((data ?? []) as Job[]);
          setState("local");
          return;
        }
        // Loggato: eventuali stelle locali pendenti salgono sull'account
        // (login via email non passa dal bottone Solana, quindi anche qui).
        const migrated = await migrateLocalSaves();
        if (migrated > 0) return; // invalidateSavedCache → refresh rientra
        if (set.size === 0) {
          setJobs([]);
          setState("ready");
          return;
        }
        const { data } = await supabase
          .from("jobs")
          .select(JOB_CARD_COLUMNS)
          .in("id", [...set])
          .order("posted_at", { ascending: false, nullsFirst: false });
        if (!alive) return;
        setJobs((data ?? []) as Job[]);
        setState("ready");
      });
    refresh();
    const unsub = subscribeSaved(refresh);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return (
    <main className="max-w-[560px] mx-auto px-4 pt-[calc(28px+env(safe-area-inset-top))]">
      <h1 className="font-sans text-[20px] font-black tracking-tight mb-4">Saved jobs</h1>

      {state === "loading" && (
        <div className="py-12 text-center font-mono text-[10px] font-bold tracking-wider text-ink-dim">
          LOADING…
        </div>
      )}

      {state === "anon" && (
        <div className="border border-line bg-card rounded-sharp px-5 py-12 text-center">
          <div className="font-sans text-[28px] mb-2">★</div>
          <div className="font-sans text-[16px] font-extrabold mb-1.5">Your shortlist lives here</div>
          <p className="font-sans text-[13px] text-ink-dim mb-5 max-w-[300px] mx-auto">
            Save roles with the star and they follow you across devices. Free account, ten seconds.
          </p>
          <Link
            href={`/signin?next=${encodeURIComponent("/app/saved")}`}
            className="inline-block bg-accent text-accent-fg font-mono text-[12px] font-bold tracking-wider px-6 py-3 rounded-sharp"
          >
            SIGN IN / JOIN →
          </Link>
        </div>
      )}

      {state === "local" && (
        <>
          <div className="border border-line bg-card rounded-sharp px-4 py-3 mb-3 flex items-center justify-between gap-3">
            <p className="font-sans text-[12px] text-ink-dim">
              These stars live only on this phone.
            </p>
            <Link
              href={`/signin?next=${encodeURIComponent("/app/saved")}`}
              className="shrink-0 font-mono text-[10px] font-bold tracking-wider text-accent"
            >
              KEEP THEM →
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {jobs.map((j) => (
              <AppJobCard key={j.id} job={j} />
            ))}
          </div>
        </>
      )}

      {state === "ready" &&
        (jobs.length === 0 ? (
          <div className="border border-line bg-card rounded-sharp px-5 py-12 text-center">
            <div className="font-sans text-[16px] font-extrabold mb-1.5">Nothing saved yet</div>
            <p className="font-sans text-[13px] text-ink-dim mb-5">
              Tap the ☆ on any job to build your shortlist.
            </p>
            <Link
              href="/app"
              className="inline-block bg-accent text-accent-fg font-mono text-[12px] font-bold tracking-wider px-6 py-3 rounded-sharp"
            >
              BROWSE MY FEED →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {jobs.map((j) => (
              <AppJobCard key={j.id} job={j} />
            ))}
          </div>
        ))}
    </main>
  );
}
