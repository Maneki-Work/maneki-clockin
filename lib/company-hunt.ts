"use client";

/**
 * Caccia alle companies (feature 30/09): swipe right = FOLLOW. Il follow
 * paga SUBITO anche senza push: i job delle companies seguite saltano in
 * cima alla caccia jobs (boost in daily-catch). Quando arriveranno le
 * notifiche mobile, i follow sono già qui. Giudizi e follow in
 * localStorage (sync su account quando nascerà la tabella, con le push).
 */
import { supabase } from "@/lib/supabase";

const JUDGED_KEY = "maneki_judged_companies";

export type CompanyJudgement = "follow" | "pass";

export type CompanyCatch = {
  slug: string;
  name: string;
  logo_url: string | null;
  category: string | null;
  description: string | null;
  jobsCount: number;
};

export function loadCompanyJudged(): Record<string, CompanyJudgement> {
  try {
    return JSON.parse(localStorage.getItem(JUDGED_KEY) ?? "{}") as Record<string, CompanyJudgement>;
  } catch {
    return {};
  }
}

export function recordCompanyJudgement(slug: string, j: CompanyJudgement): void {
  try {
    const all = loadCompanyJudged();
    all[slug] = j;
    localStorage.setItem(JUDGED_KEY, JSON.stringify(all));
  } catch { /* senza storage il deck ripropone: accettabile */ }
}

/** Slugs seguiti — letti anche dalla caccia jobs per il boost. */
export function followedCompanySlugs(): string[] {
  const judged = loadCompanyJudged();
  return Object.keys(judged).filter((slug) => judged[slug] === "follow");
}

/**
 * Prossimo batch: companies CON job attivi (ordinate per freschezza
 * dell'ultimo annuncio), meno le già giudicate. Due query: i job attivi
 * più recenti fanno da indice (count + latest per slug), poi le righe
 * companies. Array vuoto = conosciute tutte.
 */
export async function fetchCompanyBatch(excludeSlugs: Set<string>): Promise<CompanyCatch[]> {
  const judged = loadCompanyJudged();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("company_slug, posted_at")
    .eq("active", true)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const bySlug = new Map<string, { count: number; latest: string | null }>();
  for (const j of (jobs ?? []) as { company_slug: string | null; posted_at: string | null }[]) {
    if (!j.company_slug) continue;
    const cur = bySlug.get(j.company_slug);
    if (cur) cur.count += 1;
    else bySlug.set(j.company_slug, { count: 1, latest: j.posted_at });
  }

  const candidates = [...bySlug.keys()]
    .filter((slug) => !judged[slug] && !excludeSlugs.has(slug))
    .slice(0, 30);
  if (candidates.length === 0) return [];

  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("slug, name, logo_url, category, description")
    .in("slug", candidates);
  if (cErr) throw new Error(cErr.message);

  const rows = new Map(
    ((companies ?? []) as Omit<CompanyCatch, "jobsCount">[]).map((c) => [c.slug, c]),
  );
  return candidates
    .map((slug) => {
      const c = rows.get(slug);
      if (!c) return null;
      return { ...c, jobsCount: bySlug.get(slug)?.count ?? 0 };
    })
    .filter((c): c is CompanyCatch => c != null)
    .slice(0, 10);
}
