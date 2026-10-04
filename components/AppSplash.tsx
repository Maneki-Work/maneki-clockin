"use client";

import { useEffect, useRef, useState } from "react";
import { ManekiMark } from "./Logo";

/**
 * Splash dell'app (/app): renderizzato VISIBILE già lato server — è il
 * primissimo paint, così l'avvio è: splash wrapper (stesso gatto) → questo,
 * senza schermata bianca né feed che lampeggia prima del gatto (bug 27/09:
 * l'overlay compariva solo post-idratazione, cioè per ultimo).
 *
 * Non dura un tempo fisso: resta su finché la pagina sotto segnala di avere
 * contenuto reale (signalAppReady), poi UN solo fade sul contenuto pronto.
 * Prima era 900ms a prescindere → si atterrava quasi sempre su un secondo
 * loading ("FETCHING YOUR JOBS") e l'avvio sembrava a scatti (feedback 27/09).
 * Il gatto è ancorato al centro esatto dello schermo = stessa posizione
 * dell'icona nello splash di sistema TWA, così l'handoff non "salta".
 * Una volta per sessione: ai load successivi l'effect lo spegne al mount.
 */
const KEY = "maneki_app_splashed";
const READY_EVENT = "maneki:app-ready";
const MIN_MS = 600; // presenza minima: il gatto non deve flashare
const MAX_MS = 3000; // rete lenta: oltre, si rivela lo stato di caricamento della pagina

/** Le pagine /app la chiamano quando il primo contenuto utile è a schermo. */
export function signalAppReady(): void {
  try {
    window.dispatchEvent(new Event(READY_EVENT));
  } catch {}
}

export default function AppSplash() {
  const [phase, setPhase] = useState<"shown" | "fading" | "hidden">("shown");
  const done = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) {
        setPhase("hidden");
        return;
      }
      sessionStorage.setItem(KEY, "1");
    } catch {
      setPhase("hidden");
      return;
    }

    const shownAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const fadeOut = () => {
      if (done.current) return;
      done.current = true;
      setPhase("fading");
      timers.push(setTimeout(() => setPhase("hidden"), 400));
    };
    const onReady = () => {
      timers.push(setTimeout(fadeOut, Math.max(0, MIN_MS - (Date.now() - shownAt))));
    };
    window.addEventListener(READY_EVENT, onReady, { once: true });
    timers.push(setTimeout(fadeOut, MAX_MS));
    return () => {
      window.removeEventListener(READY_EVENT, onReady);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[70] bg-bg transition-opacity duration-[400ms] ease-out ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <span className="mk-beckon absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <ManekiMark size={72} />
      </span>
      <div className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+68px)] font-mono text-[11px] font-bold tracking-[0.16em] text-ink-dim">
        MANEKI<span className="mk-thinkdot">.</span>
        <span className="mk-thinkdot">.</span>
        <span className="mk-thinkdot">.</span>
      </div>
    </div>
  );
}
