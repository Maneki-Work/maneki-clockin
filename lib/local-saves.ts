"use client";

/**
 * Stelle locali per l'anonimo (fix 29/09): lo swipe right del deck deve
 * finire in SAVED anche senza account — l'app dà valore PRIMA del signup.
 * Vivono in localStorage; al primo login migrano su saved_jobs e la lista
 * locale si svuota (da lì in poi comanda il server).
 */
import { supabaseBrowser } from "@/lib/supabase-browser";
import { invalidateSavedCache } from "@/lib/saved-jobs-client";

const KEY = "maneki_local_saves";

export function localSaveIds(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function write(ids: number[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* pazienza */ }
}

export function addLocalSave(id: number): void {
  const ids = localSaveIds();
  if (!ids.includes(id)) write([id, ...ids].slice(0, 200));
}

export function removeLocalSave(id: number): void {
  write(localSaveIds().filter((x) => x !== id));
}

/**
 * Porta le stelle locali sull'account e svuota la lista. Idempotente e
 * dup-tolerante (23505 = già salvato, va bene così). Ritorna quante ne
 * ha migrate; 0 se anonimo o lista vuota.
 */
export async function migrateLocalSaves(): Promise<number> {
  const ids = localSaveIds();
  if (ids.length === 0) return 0;
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getUser();
  if (!data.user) return 0;

  const rows = ids.map((job_id) => ({ user_id: data.user!.id, job_id }));
  const { error } = await sb.from("saved_jobs").upsert(rows, { onConflict: "user_id,job_id", ignoreDuplicates: true });
  if (error) {
    console.error("local saves migration:", error.message);
    return 0;
  }
  write([]);
  invalidateSavedCache();
  return ids.length;
}
