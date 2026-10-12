/**
 * Contratto di /api/match/* come consumato da questa superficie
 * (app/app/match). Il motore di matching (lib/match-pipeline) resta
 * privato dietro il confine HTTPS — vedi docs/ARCHITECTURE.md — ma il
 * contratto che attraversa quel confine è pubblico e vive qui.
 */

/** POST /api/match/start (multipart, resume PDF ≤ 5MB) → token di scan. */
export type MatchStartResponse = { token: string };

/** POST /api/match/run { token, force? } → la board scored. */
export type MatchRunResponse = {
  results: MatchResultItem[];
  cached: boolean;
  computedAt: string | null;
};

/**
 * Un match: giudizio LLM con evidenza. Subset dei campi del motore —
 * qui solo ciò che la UI consuma.
 */
export type MatchResultItem = {
  id: string;
  title: string;
  company: string;
  salary: string | null;
  /** 0-100; ≥ 75 è evidenziato come strong match. */
  score: number;
  /** Nota di evidenza del giudizio ("evidence, not vibes"). */
  note: string | null;
};
