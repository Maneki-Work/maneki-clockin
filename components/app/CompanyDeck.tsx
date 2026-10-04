"use client";

import { useRef, useState } from "react";
import CompanyLogo from "@/components/CompanyLogo";
import { ManekiMark } from "@/components/Logo";
import type { CompanyCatch, CompanyJudgement } from "@/lib/company-hunt";

const SWIPE_THRESHOLD = 90;

/**
 * Deck delle companies: destra = FOLLOW (i loro job salgono in cima alla
 * caccia), sinistra = pass. Stessa grammatica dello swipe jobs, carta
 * più compatta, niente espansione (v1).
 */
export default function CompanyDeck({
  companies,
  onJudge,
}: {
  companies: CompanyCatch[];
  onJudge: (company: CompanyCatch, j: CompanyJudgement) => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState<CompanyJudgement | null>(null);
  const [reaction, setReaction] = useState<{ follow: boolean; key: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const top = companies[0];
  if (!top) return null;

  function release(j: CompanyJudgement | null) {
    start.current = null;
    if (!j) {
      setDrag(null);
      return;
    }
    setFlying(j);
    setReaction({ follow: j === "follow", key: Date.now() });
    setTimeout(() => {
      setFlying(null);
      setDrag(null);
      onJudge(top, j);
    }, 260);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (flying) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || flying) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function onPointerUp() {
    if (!start.current || flying) return;
    const x = drag?.x ?? 0;
    release(x > SWIPE_THRESHOLD ? "follow" : x < -SWIPE_THRESHOLD ? "pass" : null);
  }

  const x = flying === "follow" ? 500 : flying === "pass" ? -500 : (drag?.x ?? 0);
  const y = flying ? -40 : (drag?.y ?? 0) * 0.3;
  const rot = x * 0.07;
  const followOpacity = Math.min(Math.max(x / SWIPE_THRESHOLD, 0), 1);
  const passOpacity = Math.min(Math.max(-x / SWIPE_THRESHOLD, 0), 1);

  const cardBase =
    "absolute inset-0 bg-card border-[1.5px] border-line rounded-2xl px-5 py-5 flex flex-col select-none";

  return (
    <div>
      <div className="relative h-[340px]" style={{ touchAction: "pan-y" }}>
        {companies.slice(1, 3).map((c, i) => (
          <div
            key={c.slug}
            className={cardBase}
            style={{
              transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.04})`,
              zIndex: 2 - i,
              opacity: 1 - (i + 1) * 0.25,
            }}
            aria-hidden
          />
        ))}

        <div
          key={`top-${top.slug}`}
          className={`${cardBase} mk-cardin cursor-grab active:cursor-grabbing shadow-[0_8px_28px_rgba(0,0,0,0.08)]`}
          style={{
            zIndex: 10,
            transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
            transition: drag && !flying ? "none" : "transform 260ms ease",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => release(null)}
        >
          <span
            className="absolute top-4 left-4 font-mono text-[12px] font-bold tracking-wider text-good border-[2px] border-good rounded-xl px-2.5 py-1 rotate-[-8deg] bg-card"
            style={{ opacity: followOpacity }}
          >
            FOLLOW ♥
          </span>
          <span
            className="absolute top-4 right-4 font-mono text-[12px] font-bold tracking-wider text-ink-dim border-[2px] border-ink-dim rounded-xl px-2.5 py-1 rotate-[8deg] bg-card"
            style={{ opacity: passOpacity }}
          >
            PASS
          </span>

          <div className="flex flex-col items-center text-center mt-4">
            <CompanyLogo src={top.logo_url} alt={top.name} size={64} />
            <div className="font-sans text-[22px] font-extrabold tracking-tight text-ink mt-3">
              {top.name}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center mt-2 mb-3">
              {top.category && (
                <span className="font-mono text-[9.5px] font-bold tracking-wider text-ink-dim border border-line rounded-full px-2.5 py-1">
                  {top.category.replace(/-/g, " ").toUpperCase()}
                </span>
              )}
              <span className="font-mono text-[9.5px] font-bold tracking-wider text-good border border-line rounded-full px-2.5 py-1">
                {top.jobsCount} OPEN {top.jobsCount === 1 ? "ROLE" : "ROLES"}
              </span>
            </div>
            {top.description && (
              <p className="font-sans text-[13px] text-ink-dim leading-snug line-clamp-4">
                {top.description}
              </p>
            )}
          </div>
          <div className="font-mono text-[10px] font-bold tracking-wider text-ink-dim text-center mt-auto pt-3 opacity-70">
            FOLLOW → THEIR NEW ROLES TOP YOUR HUNT
          </div>
        </div>

        {reaction && (
          <div
            key={reaction.key}
            className="mk-pop absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <span className={`relative ${reaction.follow ? "text-accent" : "text-ink-dim"}`}>
              <ManekiMark size={76} />
              <span className="absolute -top-2 -right-4 text-[26px]">
                {reaction.follow ? "♥" : "💧"}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 mt-5">
        <button
          onClick={() => !flying && release("pass")}
          aria-label="Pass"
          className="w-[56px] h-[56px] rounded-full border-[1.5px] border-line bg-card text-ink-dim text-[20px] hover:border-ink hover:text-ink active:scale-95 transition-all"
        >
          ✕
        </button>
        <button
          onClick={() => !flying && release("follow")}
          aria-label="Follow"
          className="w-[64px] h-[64px] rounded-full bg-accent text-accent-fg text-[24px] hover:opacity-90 active:scale-95 transition-all shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
