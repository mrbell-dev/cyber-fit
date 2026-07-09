import { GoalsPanel } from "../components/GoalsPanel.tsx";
import { useDayKey } from "../hooks.ts";

/** Mission board for the grind — long-arc objectives live here (create, edit,
 *  archive). Telemetry keeps a read-only objectives strip for glancing. */
export function Goals() {
  const today = useDayKey();
  return (
    <section aria-label="Goals">
      <GoalsPanel today={today} />
    </section>
  );
}
