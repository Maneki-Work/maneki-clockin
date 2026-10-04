"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, type Job } from "@/lib/supabase";
import { timeAgo, SENIORITY_LABELS } from "@/lib/networks";
import { formatSalary } from "@/lib/salary";
import { capitalizeLocationToken, cleanLocationForDisplay } from "@/lib/location-display";
import { sanitizeJobPostingHtml } from "@/lib/job-content";
import { withManekiRef } from "@/lib/apply-url";
import CompanyLogo from "@/components/CompanyLogo";
import { ManekiMark } from "@/components/Logo";
import TrackedLink from "@/components/TrackedLink";
import type { Judgement } from "@/lib/daily-catch";
import { loadCompanyJudged, recordCompanyJudgement } from "@/lib/company-hunt";

const SWIPE_THRESHOLD = 90;
const TAP_TOLERANCE = 8;
const EXPAND_MS = 300;

/** Cache modulo: snippet testuali e descrizioni complete delle carte. */
const snippetCache = new Map<number, string | null>();
const descCache = new Map<number, string | null>();

/** Info company per il blocco in fondo alla scheda espansa (30/09). */
type CompanyInfo = { name: string; logo_url: string | null; category: string | null; description: string | null; jobsCount: number };
const companyCache = new Map<string, CompanyInfo | null>();

function htmlToSnippet(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 20 ? text.slice(0, 220) : null;
}

type ExpandState = { job: Job; rect: DOMRect; phase: "opening" | "open" | "closing" };

/**
 * Il deck delle prede: carte impilate, la prima si trascina — destra 😻
 * (salva), sinistra 🙅 (passa). Tap → la carta STESSA si espande a tutto
 * schermo (morph alla Tinder, niente drawer estraneo) e si giudica anche
 * da dentro. Pointer events e CSS transitions puri, zero lib.
 * Angoli morbidi di proposito: è la zona-gioco, kawaii dove il resto
 * dell'app resta brutale.
 */
export default function CatchDeck({
  jobs,
  onJudge,
}: {
  jobs: Job[];
  onJudge: (job: Job, j: Judgement) => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState<Judgement | null>(null);
  // Reazione del gatto dopo il giudizio (😻/🙈): key forza il replay.
  const [reaction, setReaction] = useState<{ like: boolean; key: number } | null>(null);
  const [expand, setExpand] = useState<ExpandState | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  // Snippet per la carta in cima e la prossima (niente pop-in allo swipe).
  const wanted = jobs.slice(0, 2).map((j) => j.id).filter((id) => !snippetCache.has(id));
  useEffect(() => {
    if (wanted.length === 0) return;
    let alive = true;
    supabase
      .from("jobs")
      .select("id, description")
      .in("id", wanted)
      .then(({ data }) => {
        if (!alive) return;
        for (const row of (data ?? []) as { id: number; description: string | null }[]) {
          snippetCache.set(row.id, htmlToSnippet(row.description));
          descCache.set(row.id, row.description);
        }
        for (const id of wanted) if (!snippetCache.has(id)) snippetCache.set(id, null);
        tick((t) => t + 1);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join(",")]);

  // Espansione: due frame (rect → fullscreen) con transition sul contenitore.
  useEffect(() => {
    if (expand?.phase !== "opening") return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setExpand((e) => (e ? { ...e, phase: "open" } : e))),
    );
    return () => cancelAnimationFrame(raf);
  }, [expand?.phase]);

  // Niente scroll del body sotto la scheda espansa.
  useEffect(() => {
    if (!expand) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [expand]);

  const top = jobs[0];
  if (!top) return null;

  function release(j: Judgement | null) {
    start.current = null;
    if (!j) {
      setDrag(null);
      return;
    }
    setFlying(j);
    setReaction({ like: j === "like", key: Date.now() });
    // La carta vola fuori, POI il giudizio avanza il deck.
    setTimeout(() => {
      setFlying(null);
      setDrag(null);
      onJudge(top, j);
    }, 260);
  }

  function openExpand() {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setExpand({ job: top, rect, phase: "opening" });
  }

  function closeExpand(after?: () => void) {
    setExpand((e) => (e ? { ...e, phase: "closing" } : e));
    setTimeout(() => {
      setExpand(null);
      after?.();
    }, EXPAND_MS);
  }

  function judgeFromExpand(j: Judgement) {
    // La scheda collassa nella carta, poi la carta vola come uno swipe.
    closeExpand(() => release(j));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (flying || expand) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || flying || expand) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function onPointerUp() {
    if (!start.current || flying || expand) return;
    const x = drag?.x ?? 0;
    const moved = Math.hypot(drag?.x ?? 0, drag?.y ?? 0);
    if (moved < TAP_TOLERANCE) {
      start.current = null;
      setDrag(null);
      openExpand();
      return;
    }
    release(x > SWIPE_THRESHOLD ? "like" : x < -SWIPE_THRESHOLD ? "pass" : null);
  }

  const x = flying === "like" ? 500 : flying === "pass" ? -500 : (drag?.x ?? 0);
  const y = flying ? -40 : (drag?.y ?? 0) * 0.3;
  const rot = x * 0.07;
  const likeOpacity = Math.min(Math.max(x / SWIPE_THRESHOLD, 0), 1);
  const passOpacity = Math.min(Math.max(-x / SWIPE_THRESHOLD, 0), 1);
  const salary = formatSalary(top);
  const skills = (top.skills ?? []).slice(0, 3);

  const cardBase =
    "absolute inset-0 bg-card border-[1.5px] border-line rounded-2xl px-5 py-5 flex flex-col select-none";

  return (
    <div>
      <div className="relative h-[380px]" style={{ touchAction: "pan-y" }}>
        {/* Le prossime due carte, impilate dietro */}
        {jobs.slice(1, 3).map((j, i) => (
          <div
            key={j.id}
            className={cardBase}
            style={{
              transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.04})`,
              zIndex: 2 - i,
              opacity: 1 - (i + 1) * 0.25,
            }}
            aria-hidden
          />
        ))}

        {/* La preda in cima — keyed: senza, React riusa il nodo e la
            transition fa "tornare indietro" la carta vecchia (Giulia) */}
        <div
          key={`top-${top.id}`}
          ref={cardRef}
          className={`${cardBase} mk-cardin cursor-grab active:cursor-grabbing shadow-[0_8px_28px_rgba(0,0,0,0.08)]`}
          style={{
            zIndex: 10,
            transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
            transition: drag && !flying ? "none" : "transform 260ms ease",
            opacity: expand ? 0 : 1, // mentre è espansa, la carta "è" l'overlay
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => release(null)}
        >
          <span
            className="absolute top-4 left-4 font-mono text-[12px] font-bold tracking-wider text-good border-[2px] border-good rounded-xl px-2.5 py-1 rotate-[-8deg] bg-card"
            style={{ opacity: likeOpacity }}
          >
            SAVE ★
          </span>
          <span
            className="absolute top-4 right-4 font-mono text-[12px] font-bold tracking-wider text-ink-dim border-[2px] border-ink-dim rounded-xl px-2.5 py-1 rotate-[8deg] bg-card"
            style={{ opacity: passOpacity }}
          >
            PASS
          </span>

          <div className="flex items-center gap-3 mb-3 mt-1">
            <CompanyLogo src={top.logo_url} alt={top.company} size={42} />
            <div className="min-w-0">
              <div className="font-sans text-[14px] font-bold text-ink truncate">{top.company}</div>
              <div className="font-mono text-[10px] tracking-wider text-ink-dim">
                {timeAgo(top.posted_at)?.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="font-sans text-[21px] font-extrabold tracking-tight leading-snug text-ink mb-2.5">
            {top.title}
          </div>

          {salary && (
            <div className="font-mono text-[13px] font-bold tracking-wider text-good mb-2">
              {salary}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(top.remote || top.city || top.location) && (
              <span className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                {(top.remote
                  ? "REMOTE"
                  : (top.city ?? capitalizeLocationToken((top.location ?? "").split(",")[0])).toUpperCase())}
              </span>
            )}
            {top.seniority && SENIORITY_LABELS[top.seniority] && (
              <span className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                {SENIORITY_LABELS[top.seniority].toUpperCase()}
              </span>
            )}
            {skills.map((s) => (
              <span key={s} className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                {s.toUpperCase()}
              </span>
            ))}
          </div>

          {snippetCache.get(top.id) && (
            <p className="font-sans text-[12.5px] text-ink-dim leading-snug line-clamp-3 mt-2.5 mb-auto">
              {snippetCache.get(top.id)}
            </p>
          )}
          <div className="font-mono text-[10px] font-bold tracking-wider text-ink-dim text-center pt-3 opacity-70 mt-auto">
            TAP TO EXPAND
          </div>
        </div>

        {/* Reazione del gatto: flash centrale, sopra tutto */}
        {reaction && (
          <div
            key={reaction.key}
            className="mk-pop absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            {/* Maneki felice/triste, MAI emoji generiche (Giulia 29/09) */}
            <span className={`relative ${reaction.like ? "text-accent" : "text-ink-dim"}`}>
              <ManekiMark size={76} />
              <span className="absolute -top-2 -right-4 text-[26px]">
                {reaction.like ? "♥" : "💧"}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Bottoni per chi non swipa */}
      <div className="flex items-center justify-center gap-4 mt-5">
        <button
          onClick={() => !flying && !expand && release("pass")}
          aria-label="Pass"
          className="w-[56px] h-[56px] rounded-full border-[1.5px] border-line bg-card text-ink-dim text-[20px] hover:border-ink hover:text-ink active:scale-95 transition-all"
        >
          ✕
        </button>
        <button
          onClick={() => !flying && !expand && release("like")}
          aria-label="Save"
          className="w-[64px] h-[64px] rounded-full bg-accent text-accent-fg text-[24px] hover:opacity-90 active:scale-95 transition-all shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
        >
          ★
        </button>
      </div>

      {expand && <ExpandedCard state={expand} onClose={() => closeExpand()} onJudge={judgeFromExpand} />}
    </div>
  );
}

/** La carta espansa: parte dal rect della carta e cresce a tutto schermo. */
function ExpandedCard({
  state,
  onClose,
  onJudge,
}: {
  state: ExpandState;
  onClose: () => void;
  onJudge: (j: Judgement) => void;
}) {
  const { job, rect, phase } = state;
  const full = phase === "open";
  const slug = job.company_slug ?? null;
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null | undefined>(
    slug && companyCache.has(slug) ? companyCache.get(slug) : undefined,
  );
  const [following, setFollowing] = useState(
    () => (slug ? loadCompanyJudged()[slug] === "follow" : false),
  );

  useEffect(() => {
    if (!slug || companyInfo !== undefined) return;
    let alive = true;
    Promise.all([
      supabase.from("companies").select("name, logo_url, category, description").eq("slug", slug).maybeSingle(),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("active", true).eq("company_slug", slug),
    ]).then(([c, n]) => {
      const info = c.data
        ? { ...(c.data as Omit<CompanyInfo, "jobsCount">), jobsCount: n.count ?? 0 }
        : null;
      companyCache.set(slug, info);
      if (alive) setCompanyInfo(info);
    });
    return () => { alive = false; };
  }, [slug, companyInfo]);
  // Anti ghost-click (Giulia 29/09): il click nativo che segue il tap di
  // apertura atterrava su APPLY appena renderizzato -> tab Ashby fantasma.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!full) return;
    const t = setTimeout(() => setArmed(true), 420);
    return () => clearTimeout(t);
  }, [full]);
  const [description, setDescription] = useState<string | null | undefined>(
    descCache.has(job.id) ? descCache.get(job.id) : undefined,
  );

  useEffect(() => {
    if (description !== undefined) return;
    let alive = true;
    supabase
      .from("jobs")
      .select("description")
      .eq("id", job.id)
      .maybeSingle()
      .then(({ data }) => {
        const html = (data?.description as string | null) ?? null;
        descCache.set(job.id, html);
        if (alive) setDescription(html);
      });
    return () => { alive = false; };
  }, [job.id, description]);

  const salary = formatSalary(job);
  const location = job.remote
    ? "Remote"
    : job.location
      ? cleanLocationForDisplay(job.location)
      : "Location not specified";
  const level = job.seniority ? SENIORITY_LABELS[job.seniority] : null;
  const applyUrl = withManekiRef(job.external_url || job.job_url);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={job.title}>
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        style={{ opacity: full ? 1 : 0, transitionDuration: `${EXPAND_MS}ms` }}
        onClick={() => armed && onClose()}
      />
      <div
        className="absolute bg-card overflow-hidden flex flex-col border-line"
        style={{
          top: full ? 0 : rect.top,
          left: full ? 0 : rect.left,
          width: full ? "100%" : rect.width,
          // 100% del parent fixed inset-0, MAI 100dvh: su Chrome Android
          // il dvh può superare il contenitore mentre la barra URL si
          // ritrae, spingendo la action bar (APPLY) sotto lo schermo.
          height: full ? "100%" : rect.height,
          borderRadius: full ? 0 : 16,
          borderWidth: full ? 0 : 1.5,
          transitionProperty: "top,left,width,height,border-radius",
          transitionDuration: `${EXPAND_MS}ms`,
          transitionTimingFunction: "cubic-bezier(.2,.9,.3,1)",
        }}
      >
        {/* Chiudi (torna al deck) */}
        <button
          onClick={() => armed && onClose()}
          aria-label="Close"
          className="absolute right-3 z-10 w-10 h-10 rounded-full bg-bg/80 backdrop-blur text-ink text-[18px] transition-opacity"
          style={{ top: `calc(8px + env(safe-area-inset-top))`, opacity: full ? 1 : 0 }}
        >
          ✕
        </button>

        <div className="overflow-y-auto flex-1 px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-4">
          <div className="max-w-[560px] mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <CompanyLogo src={job.logo_url} alt={job.company} size={44} />
              <div className="min-w-0">
                <div className="font-sans text-[14px] font-bold text-ink">{job.company}</div>
                <div className="font-mono text-[10px] tracking-wider text-ink-dim">
                  {timeAgo(job.posted_at)?.toUpperCase()}
                </div>
              </div>
            </div>
            <h2 className="font-sans text-[24px] font-black tracking-tight leading-tight mb-3.5">
              {job.title}
            </h2>
            <div className="flex gap-2 flex-wrap mb-5">
              {salary && (
                <span className="border border-line bg-bg rounded-sharp px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-good">
                  {salary}
                </span>
              )}
              <span className="border border-line bg-bg rounded-sharp px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-ink">
                {location.toUpperCase()}
              </span>
              {level && (
                <span className="border border-line bg-bg rounded-sharp px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-ink">
                  {level.toUpperCase()}
                </span>
              )}
            </div>

            {/* Il contenuto lungo appare solo a espansione completata */}
            <div className="transition-opacity" style={{ opacity: full ? 1 : 0, transitionDuration: `${EXPAND_MS}ms` }}>
              {description === undefined ? (
                <div className="py-8 text-center font-mono text-[10px] font-bold tracking-wider text-ink-dim">
                  LOADING…
                </div>
              ) : description ? (
                <div
                  className="font-sans text-[15px] leading-relaxed text-ink-dim
                    [&_p]:mb-3 [&_p:last-child]:mb-0
                    [&_h1]:text-ink [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2
                    [&_h2]:text-ink [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
                    [&_h3]:text-ink [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul>li]:mb-1
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol>li]:mb-1
                    [&_strong]:text-ink"
                  dangerouslySetInnerHTML={{ __html: sanitizeJobPostingHtml(description) }}
                />
              ) : (
                <p className="font-sans text-[14px] text-ink-dim">
                  Full description, requirements and benefits live on the original posting —
                  tap APPLY to read everything and submit directly to {job.company}.
                </p>
              )}

              {/* ABOUT THE COMPANY (feedback 29/09) — con il follow della
                  caccia companies: coerenza tra le due superfici. */}
              {companyInfo && (
                <div className="mt-7 border-t border-line pt-5 pb-2">
                  <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-dim mb-3">
                    ABOUT {companyInfo.name.toUpperCase()}
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <CompanyLogo src={companyInfo.logo_url} alt={companyInfo.name} size={40} />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {companyInfo.category && (
                        <span className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                          {companyInfo.category.replace(/-/g, " ").toUpperCase()}
                        </span>
                      )}
                      <span className="font-mono text-[9.5px] font-bold tracking-wider text-good border border-line rounded-full px-2.5 py-1">
                        {companyInfo.jobsCount} OPEN {companyInfo.jobsCount === 1 ? "ROLE" : "ROLES"}
                      </span>
                    </div>
                  </div>
                  {companyInfo.description && (
                    <p className="font-sans text-[13.5px] text-ink-dim leading-relaxed mb-4">
                      {companyInfo.description}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (!slug || following) return;
                      recordCompanyJudgement(slug, "follow");
                      setFollowing(true);
                    }}
                    disabled={following}
                    className={`w-full font-mono text-[12px] font-bold tracking-wider py-3 rounded-xl border-[1.5px] transition-all ${
                      following
                        ? "border-line bg-card text-ink-dim"
                        : "border-ink bg-ink text-bg hover:opacity-90 active:scale-[0.99]"
                    }`}
                  >
                    {following ? "FOLLOWING ✓ — THEIR NEW ROLES TOP YOUR HUNT" : `♥ FOLLOW ${companyInfo.name.toUpperCase()}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Giudizio anche da dentro, alla Tinder + APPLY */}
        <div
          className="shrink-0 border-t border-line bg-bg px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] transition-opacity"
          style={{ opacity: full ? 1 : 0, transitionDuration: `${EXPAND_MS}ms`, pointerEvents: armed ? "auto" : "none" }}
        >
          <div className="max-w-[560px] mx-auto flex items-center gap-3">
            <button
              onClick={() => onJudge("pass")}
              aria-label="Pass"
              className="w-12 h-12 shrink-0 rounded-full border-[1.5px] border-line bg-card text-ink-dim text-[18px] hover:border-ink hover:text-ink active:scale-95 transition-all"
            >
              ✕
            </button>
            <button
              onClick={() => onJudge("like")}
              aria-label="Save"
              className="w-12 h-12 shrink-0 rounded-full bg-ink text-bg text-[20px] active:scale-95 transition-all"
            >
              ★
            </button>
            <TrackedLink
              event="apply_click"
              eventProps={{ company: job.company, role: job.role_category ?? "unknown", surface: "app_card_expand", remote: !!job.remote, has_salary: job.salary_min != null || job.salary_max != null }}
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center h-12 bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider rounded-sharp hover:opacity-90 transition-opacity"
            >
              APPLY →
            </TrackedLink>
          </div>
        </div>
      </div>
    </div>
  );
}
