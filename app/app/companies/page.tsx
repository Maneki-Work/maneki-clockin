"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isOnboarded } from "@/lib/app-prefs";
import {
  fetchCompanyBatch, recordCompanyJudgement, followedCompanySlugs,
  type CompanyCatch, type CompanyJudgement,
} from "@/lib/company-hunt";
import { ManekiMark } from "@/components/Logo";
import { signalAppReady } from "@/components/AppSplash";
import CompanyDeck from "@/components/app/CompanyDeck";
import { trackEvent } from "@/lib/analytics";

/**
 * COMPANIES — tab dedicato (scelta utente 30/09: categoria di prima
 * classe, non un toggle dentro la caccia). Swipe right = follow: i nuovi
 * ruoli della company salgono in cima alla caccia jobs; quando arriverà
 * il push, follow = notifica. Nessun cap: il pool è finito.
 */
export default function AppCompaniesPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<CompanyCatch[] | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [followedCount, setFollowedCount] = useState(0);
  const [netError, setNetError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const ensureQueue = useCallback(async (current: CompanyCatch[]) => {
    if (exhausted) return;
    try {
      const batch = await fetchCompanyBatch(new Set(current.map((c) => c.slug)));
      setNetError(false);
      if (batch.length === 0) setExhausted(true);
      else setQueue((q) => {
        const have = new Set((q ?? []).map((c) => c.slug));
        return [...(q ?? []), ...batch.filter((c) => !have.has(c.slug))];
      });
    } catch {
      if (current.length === 0) setNetError(true);
    } finally {
      signalAppReady();
    }
  }, [exhausted]);

  useEffect(() => {
    if (!isOnboarded()) {
      router.replace("/app/start");
      return;
    }
    trackEvent("app_companies_shown", {});
    setFollowedCount(followedCompanySlugs().length);
    setQueue((q) => q ?? []);
    void ensureQueue([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, router]);

  function judge(company: CompanyCatch, j: CompanyJudgement) {
    recordCompanyJudgement(company.slug, j);
    trackEvent("app_company_judged", { verdict: j });
    if (j === "follow") setFollowedCount((n) => n + 1);
    setQueue((q) => {
      const next = (q ?? []).filter((c) => c.slug !== company.slug);
      if (next.length < 3) void ensureQueue(next);
      return next;
    });
  }

  return (
    <main className="max-w-[480px] mx-auto px-5 pt-[calc(20px+env(safe-area-inset-top))] pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="mk-beckon shrink-0"><ManekiMark size={30} /></span>
          <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-dim truncate">
            WHO&apos;S HIRING
          </span>
        </div>
        <div className="font-mono text-[10px] font-bold tracking-wider text-ink-dim shrink-0">
          ♥ {followedCount} FOLLOWING
        </div>
      </div>

      {netError && (
        <div className="border-[1.5px] border-line bg-card rounded-2xl p-5">
          <p className="font-sans text-[13px] text-ink-dim mb-3">
            Couldn&apos;t load companies — network trouble.
          </p>
          <button
            onClick={() => { setNetError(false); setAttempt((a) => a + 1); }}
            className="font-mono text-[11px] font-bold tracking-wider text-accent"
          >
            TRY AGAIN →
          </button>
        </div>
      )}

      {!netError && queue != null && queue.length > 0 && (
        <>
          <p className="font-sans text-[12.5px] text-ink-dim mb-4">
            Follow a company and its new roles jump to the top of your hunt.
          </p>
          <CompanyDeck companies={queue} onJudge={judge} />
        </>
      )}

      {!netError && queue != null && queue.length === 0 && exhausted && (
        <div className="border-[1.5px] border-line bg-card rounded-2xl p-5">
          <div className="font-sans text-[16px] font-extrabold tracking-tight mb-1">
            You&apos;ve met everyone hiring 👏
          </div>
          <p className="font-sans text-[13px] text-ink-dim">
            {followedCount > 0
              ? `Following ${followedCount} — their new roles will top your hunt.`
              : "New companies show up here as they post fresh roles."}
          </p>
        </div>
      )}

      {!netError && (queue == null || (queue.length === 0 && !exhausted)) && (
        <div className="py-14 text-center font-mono text-[11px] font-bold tracking-wider text-ink-dim">…</div>
      )}
    </main>
  );
}
