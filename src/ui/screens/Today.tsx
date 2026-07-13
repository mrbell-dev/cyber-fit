import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { useDayKey, useSettings } from "../hooks.ts";
import { WaterGauge } from "../components/WaterGauge.tsx";
import { XpBar } from "../components/XpBar.tsx";
import { MoodRow } from "../components/MoodRow.tsx";
import { MissedPing } from "../components/MissedPing.tsx";
import { GoalBanner } from "../components/GoalBanner.tsx";
import { Highlight } from "../components/Highlight.tsx";
import { DailyBoot } from "../components/DailyBoot.tsx";
import { GigMigration } from "../components/GigMigration.tsx";
import { DirectivesCard } from "../components/DirectivesCard.tsx";
import { GigList } from "../components/GigList.tsx";
import { Onboarding } from "../components/Onboarding.tsx";

export function Today() {
  const today = useDayKey();
  const settings = useSettings();
  const waterLogs = useLiveQuery(() => db.waterLogs.where({ dayKey: today }).toArray(), [today]);

  if (!waterLogs) return null;

  return (
    <section aria-label="Today">
      <Onboarding />
      <DailyBoot today={today} />
      <GigMigration today={today} />
      <MissedPing today={today} />
      <GoalBanner today={today} />
      <XpBar />

      <DirectivesCard />

      <WaterGauge logs={waterLogs} goalMl={settings.waterGoalMl} unit={settings.waterUnit ?? "ml"} today={today} />

      <GigList today={today} />

      <MoodRow today={today} />

      <Highlight today={today} />
    </section>
  );
}
