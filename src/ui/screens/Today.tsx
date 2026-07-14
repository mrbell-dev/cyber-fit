import { useDayKey } from "../hooks.ts";
import { XpBar } from "../components/XpBar.tsx";
import { MissedPing } from "../components/MissedPing.tsx";
import { GoalBanner } from "../components/GoalBanner.tsx";
import { DailyBoot } from "../components/DailyBoot.tsx";
import { GigMigration } from "../components/GigMigration.tsx";
import { Onboarding } from "../components/Onboarding.tsx";
import { Dashboard } from "../components/Dashboard.tsx";

export function Today() {
  const today = useDayKey();

  return (
    <section aria-label="Today">
      <Onboarding />
      <DailyBoot today={today} />
      <GigMigration today={today} />
      <MissedPing today={today} />
      <GoalBanner today={today} />
      <XpBar />

      <Dashboard pageId="home" />
    </section>
  );
}
