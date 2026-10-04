"use client";

import { ManekiMark } from "@/components/Logo";

/**
 * Tutorial one-shot della caccia: lo swipe non è auto-evidente (feedback
 * 01/10), quindi al primo ingresso post-onboarding il gatto mostra i gesti
 * con una carta fantasma animata. Overlay sopra il deck vero; si chiude col
 * bottone (o tap sul fondo) e non torna più — flag in /app (HUNT_TUTORIAL_KEY).
 */
export default function HuntTutorial({ onDone }: { onDone: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="How the hunt works"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onDone} />
      <div className="relative w-full max-w-[340px]">
        {/* Il gatto spiega */}
        <div className="flex items-start gap-3 mb-5">
          <span className="mk-beckon shrink-0"><ManekiMark size={44} /></span>
          <div className="mk-bubble relative bg-card border-[1.5px] border-line rounded-2xl rounded-tl-md px-3.5 py-2.5">
            <p className="font-sans text-[13.5px] text-ink leading-snug">
              First hunt? Each card is a job — judge it with a flick ♪
            </p>
          </div>
        </div>

        {/* Carta fantasma che mima lo swipe */}
        <div className="relative h-[150px] mb-5" aria-hidden>
          <div className="mk-demoswipe absolute inset-x-8 inset-y-0 bg-card border-[1.5px] border-line rounded-2xl px-4 py-4 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
            <span className="mk-demosave absolute top-3 left-3 font-mono text-[11px] font-bold tracking-wider text-good border-[2px] border-good rounded-xl px-2 py-0.5 rotate-[-8deg] bg-card">
              SAVE ★
            </span>
            <span className="mk-demopass absolute top-3 right-3 font-mono text-[11px] font-bold tracking-wider text-ink-dim border-[2px] border-ink-dim rounded-xl px-2 py-0.5 rotate-[8deg] bg-card">
              PASS
            </span>
            <div className="h-full flex flex-col justify-end gap-2">
              <div className="h-2.5 w-2/3 rounded-full bg-line" />
              <div className="h-2.5 w-1/2 rounded-full bg-line opacity-60" />
            </div>
          </div>
        </div>

        {/* I tre gesti */}
        <div className="bg-card border-[1.5px] border-line rounded-2xl px-4 py-1 mb-4">
          {[
            { k: "→", label: "SWIPE RIGHT", desc: "star it — saved for later", good: true },
            { k: "←", label: "SWIPE LEFT", desc: "pass — gone for good", good: false },
            { k: "👆", label: "TAP THE CARD", desc: "read the full posting & apply", good: false },
          ].map((g) => (
            <div key={g.label} className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0">
              <span className="w-8 text-center text-[18px] shrink-0">{g.k}</span>
              <div className="min-w-0">
                <span className={`font-mono text-[10.5px] font-bold tracking-wider ${g.good ? "text-good" : "text-ink"}`}>
                  {g.label}
                </span>
                <span className="font-sans text-[12.5px] text-ink-dim"> — {g.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDone}
          className="w-full bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider py-4 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all"
        >
          GOT IT — START THE HUNT →
        </button>
      </div>
    </div>
  );
}
