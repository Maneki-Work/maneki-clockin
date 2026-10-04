"use client";

/**
 * La caccia del gatto (modello Tinder, 29/09 sera): non più 5 prede
 * congelate — si swipa a coda continua finché il cap giornaliero non
 * blocca (FREE_SWIPES_PER_DAY in streak.ts; collare d'oro SKR = senza
 * limiti). Il pool resta heuristic e gratis: prefs + freschezza, zero
 * LLM. I giudizi (😻/🙅) vivono in localStorage per sempre: una preda
 * giudicata non torna mai.
 */
import { supabase, type Job } from "@/lib/supabase";
import { JOB_CARD_COLUMNS } from "@/lib/job-columns";
import { loadAppPrefs, applyPrefsToQuery } from "@/lib/app-prefs";
import { followedCompanySlugs } from "@/lib/company-hunt";
import { todayKey } from "@/lib/streak";

const JUDGED_KEY = "maneki_judged";
const BATCH = 12;
const POOL = 60;

export type Judgement = "like" | "pass";

export function loadJudged(): Record<string, Judgement> {
  try {
    return JSON.parse(localStorage.getItem(JUDGED_KEY) ?? "{}") as Record<string, Judgement>;
  } catch {
    return {};
  }
}

export function recordJudgement(jobId: number, j: Judgement): void {
  try {
    const all = loadJudged();
    all[String(jobId)] = j;
    localStorage.setItem(JUDGED_KEY, JSON.stringify(all));
  } catch { /* senza storage il deck ripropone: accettabile */ }
}

/** PRNG deterministico (mulberry32) seedato su giorno+device. */
function seeded(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function deviceId(): string {
  try {
    // Pulizia dei deck congelati del vecchio modello (pre-Tinder).
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("maneki_catch:")) localStorage.removeItem(k);
    }
    let id = localStorage.getItem("maneki_device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("maneki_device", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Prossimo batch di prede: pool = i POOL job più freschi che passano le
 * prefs, meno giudicati ed esclusi (la coda già in mano); ordine mescolato
 * col seed del giorno (stabile ai reload, diverso domani). Pool magro →
 * si allarga senza prefs. Array vuoto = territorio ripulito.
 */
export async function fetchCatchBatch(excludeIds: Set<number>): Promise<Job[]> {
  const judged = loadJudged();
  const prefs = loadAppPrefs();
  const keep = (j: Job) => !judged[String(j.id)] && !excludeIds.has(j.id);

  const query = (withPrefs: boolean) => {
    let q = supabase.from("jobs").select(JOB_CARD_COLUMNS).eq("active", true);
    if (withPrefs) q = applyPrefsToQuery(q, prefs);
    return q.order("posted_at", { ascending: false, nullsFirst: false }).limit(POOL);
  };

  const { data, error } = await query(true);
  if (error) throw new Error(error.message);
  let pool = ((data ?? []) as Job[]).filter(keep);

  if (pool.length < BATCH) {
    const { data: broad } = await query(false);
    const seen = new Set(pool.map((j) => j.id));
    pool = pool.concat(((broad ?? []) as Job[]).filter((j) => !seen.has(j.id) && keep(j)));
  }

  const rand = seeded(`${todayKey()}:${deviceId()}`);
  for (let i = pool.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    [pool[i], pool[k]] = [pool[k], pool[i]];
  }

  // Ranking (mai filtro): companies SEGUITE prima di tutto (è la promessa
  // del follow: i loro job saltano in cima), poi il match skills; dentro
  // ogni fascia resta lo shuffle del giorno.
  const wanted = (prefs.skills ?? []).map((s) => s.toLowerCase());
  const followed = new Set(followedCompanySlugs());
  if (wanted.length > 0 || followed.size > 0) {
    const score = (j: Job) => {
      const hay = `${(j.skills ?? []).join(" ")} ${j.title}`.toLowerCase();
      const skillHits = wanted.reduce((n, s) => n + (hay.includes(s) ? 1 : 0), 0);
      return (followed.has(j.company_slug ?? "") ? 100 : 0) + skillHits;
    };
    pool = pool
      .map((j, i) => ({ j, i, s: score(j) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.j);
  }
  return pool.slice(0, BATCH);
}
