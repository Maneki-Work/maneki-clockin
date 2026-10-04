"use client";

/**
 * Clock-in streak (pivot gamified 29/09): aprire l'app e guardare le prede
 * del giorno = timbrare. Stato in localStorage — zero frizione quotidiana;
 * la prova on-chain arriva alle milestone (stamp firmato dal wallet), non
 * ogni giorno. Il giorno è locale al device: il rituale è dell'utente,
 * non del server.
 */

const KEY = "maneki_streak";

export type StreakState = {
  /** Ultimo giorno timbrato, YYYY-MM-DD locale. */
  lastDay: string | null;
  streak: number;
  /** Miglior streak mai raggiunta (per la bacheca/milestone). */
  best: number;
  /** Koban accumulati (v1: solo contatore, l'economia arriva dopo). */
  koban: number;
};

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayKey(): string {
  return todayKey(new Date(Date.now() - 86_400_000));
}

export function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<StreakState>;
      return {
        lastDay: typeof p.lastDay === "string" ? p.lastDay : null,
        streak: typeof p.streak === "number" ? p.streak : 0,
        best: typeof p.best === "number" ? p.best : 0,
        koban: typeof p.koban === "number" ? p.koban : 0,
      };
    }
  } catch { /* localStorage rotto/pieno: si riparte da zero */ }
  return { lastDay: null, streak: 0, best: 0, koban: 0 };
}

function save(s: StreakState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* idem */ }
}

export function hasClockedInToday(): boolean {
  return loadStreak().lastDay === todayKey();
}

/**
 * Timbra oggi. Idempotente: la seconda chiamata dello stesso giorno non
 * cambia nulla. Streak: ieri timbrato → +1, altrimenti riparte da 1.
 */
export function clockInToday(): { state: StreakState; isNew: boolean } {
  const s = loadStreak();
  const today = todayKey();
  if (s.lastDay === today) return { state: s, isNew: false };

  const streak = s.lastDay === yesterdayKey() ? s.streak + 1 : 1;
  const next: StreakState = {
    lastDay: today,
    streak,
    best: Math.max(s.best, streak),
    koban: s.koban + 1, // 1 koban al giorno per il timbro; il resto dopo
  };
  save(next);
  return { state: next, isNew: true };
}

/** Koban extra (giudizio prede, milestone…). */
export function earnKoban(n: number): StreakState {
  const s = loadStreak();
  const next = { ...s, koban: s.koban + n };
  save(next);
  return next;
}

/**
 * Cap swipe giornaliero (modello Tinder, 29/09): il free swipa finché il
 * gatto non si stanca, il collare d'oro SKR non si ferma mai. Contatore
 * per-giorno in localStorage, chiave datata = si azzera da sola.
 */
export const FREE_SWIPES_PER_DAY = 20;
const SWIPES_PREFIX = "maneki_swipes:";

export function swipesToday(): number {
  try {
    return Number(localStorage.getItem(SWIPES_PREFIX + todayKey()) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export function recordSwipe(): number {
  const n = swipesToday() + 1;
  try {
    // I contatori dei giorni passati non servono più.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(SWIPES_PREFIX) && k !== SWIPES_PREFIX + todayKey()) localStorage.removeItem(k);
    }
    localStorage.setItem(SWIPES_PREFIX + todayKey(), String(n));
  } catch { /* senza storage niente cap: accettabile */ }
  return n;
}
