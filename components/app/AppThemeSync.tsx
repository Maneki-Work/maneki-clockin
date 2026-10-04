"use client";

import { useEffect } from "react";

/**
 * Dentro /app il tema segue SEMPRE il sistema (standard mobile): la status
 * bar della TWA è colorata dal wrapper in base al dark mode del telefono
 * (#FAFAF7 / #0F0F12) — se il contenuto restasse inchiodato a una scelta
 * manuale fatta sul sito, tra barra e sfondo apparirebbe una banda
 * (bug segnalato 26/09 sera). Live-sync anche a cambio tema di sistema.
 */
export default function AppThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return null;
}
