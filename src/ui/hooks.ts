import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_SETTINGS, dayKeyFor, type DayKey, type Settings } from "../engine/index.ts";
import { db } from "../db/db.ts";

export function useSettings(): Settings {
  const settings = useLiveQuery(async () => {
    const row = await db.kv.get("settings");
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
  }, []);
  return settings ?? DEFAULT_SETTINGS;
}

/** Today's dayKey, kept fresh across the day rollover (checked once a minute). */
export function useDayKey(): DayKey {
  const { dayStartHour } = useSettings();
  const compute = () => {
    const now = Date.now();
    return dayKeyFor(now, new Date(now).getTimezoneOffset(), dayStartHour);
  };
  const [key, setKey] = useState<DayKey>(compute);

  useEffect(() => {
    const tick = () => setKey(compute());
    tick();
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStartHour]);

  return key;
}
