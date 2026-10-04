/**
 * Preferenze dell'app mobile (/app): unica fonte per onboarding (/app/start),
 * feed For You (/app) e editor nel profilo (/app/profile).
 *
 * Vivono in localStorage: l'app deve dare valore PRIMA del signup (decisione
 * 26/09, no entry barrier). Quando l'utente si logga si potranno sincronizzare
 * sull'account (TODO col profilo matching).
 */

export const APP_PREFS_KEY = "maneki_app_prefs";
export const APP_ONBOARDED_KEY = "maneki_app_onboarded";

export interface AppPrefs {
  /** Multi dal 30/09 (feedback design): più mestieri, più territori. */
  roles: string[];
  level: string | null;
  places: string[];
  /** Restano per il ranking della caccia (lo step onboarding è stato tolto). */
  skills?: string[];
  savedAt?: string;
}

export const APP_ROLES: { id: string; label: string; blurb: string }[] = [
  { id: "engineering", label: "Engineer", blurb: "Smart contracts, infra, full-stack" },
  { id: "product", label: "Product", blurb: "PM, strategy, growth loops" },
  { id: "design", label: "Designer", blurb: "Product, brand, motion" },
  { id: "marketing", label: "Marketer", blurb: "Content, community, growth" },
  { id: "sales", label: "Sales / BD", blurb: "Partnerships, institutional" },
  { id: "trading", label: "Trader / Quant", blurb: "Markets, research, risk" },
  { id: "operations", label: "Operations", blurb: "Ops, finance, people" },
  { id: "customer_support", label: "Support", blurb: "CS, community help" },
];

export const APP_LEVELS: { id: string | null; label: string; blurb: string }[] = [
  { id: "entry_level", label: "Getting started", blurb: "Intern / junior / first Web3 role" },
  { id: "mid_senior", label: "In the game", blurb: "Mid-level, a few years in" },
  { id: "senior", label: "Veteran", blurb: "Senior / staff / lead" },
  { id: "director", label: "Leader", blurb: "Director / VP / C-level" },
  { id: null, label: "Don't box me in", blurb: "Show everything" },
];

/**
 * Skills per l'onboarding stile Tinder (step "passions", 29/09): multi
 * select, max 5. Pesano sul RANKING del pool (non filtrano: una skill
 * di nicchia non deve svuotare la caccia). Match case-insensitive su
 * jobs.skills + titolo.
 */
export const APP_SKILLS: string[] = [
  "Solidity", "Rust", "TypeScript", "React", "Python", "Go",
  "Solana", "DeFi", "Security", "Data", "AI",
  "Marketing", "Content", "Community", "Partnerships", "Legal",
];
export const APP_SKILLS_MAX = 5;

export const APP_PLACES: { id: string | null; label: string; blurb: string }[] = [
  { id: "REMOTE", label: "Remote, always", blurb: "Anywhere with wifi" },
  { id: "AMERICAS", label: "Americas", blurb: "US, Canada, LATAM timezones" },
  { id: "EMEA", label: "Europe / EMEA", blurb: "CET-friendly hours" },
  { id: "APAC", label: "APAC", blurb: "Asia-Pacific timezones" },
  { id: null, label: "Anywhere", blurb: "Location is a detail" },
];

export function loadAppPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(APP_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      // Migrazione dal formato single-select (pre 30/09).
      const roles = Array.isArray(p.roles) ? p.roles : p.role ? [p.role] : [];
      const places = Array.isArray(p.places) ? p.places : p.place ? [p.place] : [];
      return {
        roles, level: p.level ?? null, places,
        skills: Array.isArray(p.skills) ? p.skills : [], savedAt: p.savedAt,
      };
    }
  } catch {}
  return { roles: [], level: null, places: [], skills: [] };
}

export function saveAppPrefs(p: AppPrefs): void {
  try {
    localStorage.setItem(APP_PREFS_KEY, JSON.stringify({ ...p, savedAt: new Date().toISOString() }));
    localStorage.setItem(APP_ONBOARDED_KEY, "1");
  } catch {}
}

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(APP_ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Chips leggibili per l'header del feed ("Engineer · Veteran · Remote"). */
export function prefsChips(p: AppPrefs): string[] {
  const chips: string[] = [];
  for (const id of p.roles) {
    const role = APP_ROLES.find((r) => r.id === id);
    if (role) chips.push(role.label);
  }
  const level = APP_LEVELS.find((l) => l.id === p.level && l.id != null);
  if (level) chips.push(level.label);
  for (const id of p.places) {
    const place = APP_PLACES.find((pl) => pl.id === id && pl.id != null);
    if (place) chips.push(place.label);
  }
  return chips;
}

/**
 * Ogni scelta di livello copre una BANDA di seniority adiacenti, non un solo
 * bucket: il match esatto tagliava fuori troppo inventario (es. "Leader" =
 * solo director, perdendo VP e C-level). I job senza seniority (~12%, titoli
 * generici spesso aperti a più livelli) restano sempre inclusi.
 */
const APP_LEVEL_BANDS: Record<string, string[]> = {
  entry_level: ["entry_level", "associate"],
  mid_senior: ["associate", "mid_senior"],
  senior: ["senior"],
  director: ["director", "vice_president", "cxo"],
};

/** Applica le preferenze a una query supabase sul feed jobs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPrefsToQuery<T>(q: T, p: AppPrefs): T {
  let out: any = q;
  if (p.roles.length > 0) out = out.in("role_category", p.roles);
  if (p.level) {
    const band = APP_LEVEL_BANDS[p.level] ?? [p.level];
    out = out.or(`seniority.in.(${band.join(",")}),seniority.is.null`);
  }
  // Territori multi: REMOTE convive con le regioni in OR (gruppi .or
  // distinti vengono messi in AND da supabase, quindi uno solo qui).
  const regions = p.places.filter((x) => x !== "REMOTE");
  const wantsRemote = p.places.includes("REMOTE");
  if (wantsRemote && regions.length > 0) {
    out = out.or(`remote.eq.true,region_macro.in.(${regions.join(",")})`);
  } else if (wantsRemote) {
    out = out.eq("remote", true);
  } else if (regions.length > 0) {
    out = out.in("region_macro", regions);
  }
  return out as T;
}
