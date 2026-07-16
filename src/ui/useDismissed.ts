import { useState } from "react";
import type { DayKey } from "../engine/index.ts";

/** Per-day banner dismissal. Keyed to today so a ✕ only quiets the banner
 *  until tomorrow — never forever. Same localStorage pattern as Install.tsx. */
export function useDismissed(name: string, today: DayKey) {
  const key = `cf-dismiss:${name}:${today}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === "1");
  const dismiss = () => {
    localStorage.setItem(key, "1");
    setDismissed(true);
  };
  return [dismissed, dismiss] as const;
}
