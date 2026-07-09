import { useDayKey } from "../hooks.ts";
import { BioScanCard } from "../components/BioMetrics.tsx";
import { ScreenerCard } from "../components/Screeners.tsx";

export function Bio() {
  const today = useDayKey();
  return (
    <section aria-label="Bio">
      <BioScanCard today={today} />
      <ScreenerCard />
    </section>
  );
}
