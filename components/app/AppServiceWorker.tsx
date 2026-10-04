"use client";

import { useEffect } from "react";

/** Registra il service worker (fallback offline) — montato nel layout /app. */
export default function AppServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
