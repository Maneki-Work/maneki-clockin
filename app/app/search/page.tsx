"use client";

import { useEffect, useState } from "react";
import { supabase, Job, JOB_CARD_COLUMNS } from "@/lib/supabase";
import { APP_ROLES, APP_LEVELS, APP_PLACES } from "@/lib/app-prefs";
import AppJobCard from "@/components/app/AppJobCard";
import { signalAppReady } from "@/components/AppSplash";

const PAGE = 40;

function escapeOr(s: string) {
  return s.replace(/[,()]/g, " ").trim();
}

/**
 * SEARCH — ricerca libera + chips filtro rapide (ruolo / livello / dove),
 * indipendente dalle preferenze del feed: qui si esplora tutto.
 */
export default function AppSearchPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    signalAppReady();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      let query = supabase
        .from("jobs")
        .select(JOB_CARD_COLUMNS, { count: "exact" })
        .eq("active", true);
      if (role) query = query.eq("role_category", role);
      if (level) query = query.eq("seniority", level);
      if (place === "REMOTE") query = query.eq("remote", true);
      else if (place) query = query.eq("region_macro", place);
      const term = escapeOr(q);
      if (term) query = query.or(`title.ilike.%${term}%,company.ilike.%${term}%`);
      query
        .order("posted_at", { ascending: false, nullsFirst: false })
        .range(0, limit - 1)
        .then(({ data, count, error }) => {
          if (cancelled) return;
          if (!error && data) {
            setJobs(data as Job[]);
            setTotal(count ?? data.length);
          }
          setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, role, level, place, limit]);

  const ChipRow = <T extends { id: string | null; label: string }>({
    items,
    value,
    onPick,
  }: {
    items: T[];
    value: string | null;
    onPick: (id: string | null) => void;
  }) => (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items
        .filter((i) => i.id != null)
        .map((i) => (
          <button
            key={i.id}
            onClick={() => onPick(value === i.id ? null : i.id)}
            className={`shrink-0 border rounded-sharp px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider transition-colors ${
              value === i.id
                ? "border-accent bg-accent text-accent-fg"
                : "border-line bg-card text-ink-dim hover:text-ink"
            }`}
          >
            {i.label.toUpperCase()}
          </button>
        ))}
    </div>
  );

  return (
    <main className="max-w-[560px] mx-auto px-4 pt-[calc(28px+env(safe-area-inset-top))]">
      <h1 className="font-sans text-[20px] font-black tracking-tight mb-4">Search everything</h1>

      <div className="flex border-[1.5px] border-ink bg-card rounded-sharp mb-3">
        <div className="px-3 flex items-center text-ink-dim font-mono">⌕</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Title, company, keyword…"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent outline-none font-sans text-[15px] text-ink py-3 pr-3 placeholder:text-ink-dim"
        />
        {q && (
          <button onClick={() => setQ("")} className="px-3 text-ink-dim hover:text-ink font-sans">
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <ChipRow items={APP_ROLES} value={role} onPick={setRole} />
        <ChipRow items={APP_LEVELS} value={level} onPick={setLevel} />
        <ChipRow items={APP_PLACES} value={place} onPick={setPlace} />
      </div>

      <div className="font-mono text-[10px] font-bold tracking-wider text-ink-dim mb-3">
        {loading ? "SEARCHING…" : `${(total ?? 0).toLocaleString("en-US")} RESULTS`}
      </div>

      <div className="flex flex-col gap-2.5">
        {jobs.map((j) => (
          <AppJobCard key={j.id} job={j} />
        ))}
      </div>

      {!loading && total != null && total > jobs.length && (
        <div className="py-5 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="border border-line bg-card rounded-sharp font-mono text-[11px] font-bold tracking-wider text-ink px-6 py-2.5 hover:border-ink transition-colors"
          >
            MORE ({(total - jobs.length).toLocaleString("en-US")} LEFT)
          </button>
        </div>
      )}
      {!loading && jobs.length === 0 && (
        <div className="border border-line bg-card rounded-sharp px-5 py-12 text-center font-sans text-[14px] text-ink-dim">
          Nothing matches — try fewer filters.
        </div>
      )}
    </main>
  );
}
