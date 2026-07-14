import type { JSX } from "react";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { BlockId } from "./layout";
import { db } from "../db/db.ts";
import { useDayKey, useSettings } from "./hooks.ts";
import { DirectivesCard } from "./components/DirectivesCard";
import { WaterGauge } from "./components/WaterGauge.tsx";
import { GigList } from "./components/GigList.tsx";
import { MoodRow } from "./components/MoodRow.tsx";
import { Highlight } from "./components/Highlight.tsx";
import { GoalsPanel } from "./components/GoalsPanel.tsx";
import { WeightChart, useBodyLogs } from "./components/BodyMetrics.tsx";
import { VolumeChart } from "./components/BodyMetrics.tsx";
import { BreathingOverlay } from "./components/Breathing.tsx";
import { logWeight } from "../db/repo.ts";

export interface BlockDef {
  id: BlockId;
  name: string;
  desc: string;
  Component: () => JSX.Element | null;
}

function WaterBlock() {
  const today = useDayKey();
  const settings = useSettings();
  const waterLogs = useLiveQuery(() => db.waterLogs.where({ dayKey: today }).toArray(), [today]);

  if (!waterLogs) return <></>;

  return <WaterGauge logs={waterLogs} goalMl={settings.waterGoalMl} unit={settings.waterUnit ?? "ml"} today={today} />;
}

function GigsBlock() {
  const today = useDayKey();
  return <GigList today={today} />;
}

function MoodBlock() {
  const today = useDayKey();
  return <MoodRow today={today} />;
}

function HighlightBlock() {
  const today = useDayKey();
  return <Highlight today={today} />;
}

function GoalsBlock() {
  const today = useDayKey();
  return <GoalsPanel today={today} />;
}

function WeightBlock() {
  const settings = useSettings();
  const [value, setValue] = useState("");
  const logs = useBodyLogs();

  if (!logs) return <></>;

  const unit = settings.weightUnit ?? "lbs";

  const submit = async () => {
    const w = Number(value);
    if (!w) return;
    await logWeight(w, unit);
    setValue("");
  };

  return (
    <div className="card">
      <h2 className="card-title">Weight</h2>
      {logs.length >= 2 && <WeightChart />}
      <div className="form-row">
        <input
          className="input num-input"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={unit}
          aria-label={`Weight in ${unit}`}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn" onClick={submit} disabled={!Number(value)}>
          Log scan
        </button>
      </div>
    </div>
  );
}

function VolumeBlock() {
  const today = useDayKey();
  return <VolumeChart today={today} />;
}

function BreathingBlock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button style={{ minHeight: 48 }} onClick={() => setOpen(true)}>
        Breathing — 60 seconds to reset
      </button>
      {open && <BreathingOverlay onClose={() => setOpen(false)} />}
    </div>
  );
}

export const BLOCKS: Record<BlockId, BlockDef> = {
  directives: { id: "directives", name: "Directives", desc: "Your standing orders for the day", Component: DirectivesCard },
  water: { id: "water", name: "Water", desc: "Hydration gauge and quick logging", Component: WaterBlock },
  gigs: { id: "gigs", name: "Gigs", desc: "Today's one-off missions", Component: GigsBlock },
  mood: { id: "mood", name: "Mood", desc: "One-tap mood check-in", Component: MoodBlock },
  highlight: { id: "highlight", name: "Highlight", desc: "The one thing that matters most today", Component: HighlightBlock },
  goalsPanel: { id: "goalsPanel", name: "Goals", desc: "Active goals at a glance", Component: GoalsBlock },
  weight: { id: "weight", name: "Weight", desc: "Trend chart plus quick log", Component: WeightBlock },
  volume: { id: "volume", name: "Training volume", desc: "Lifted volume over time", Component: VolumeBlock },
  breathing: { id: "breathing", name: "Breathing", desc: "Launch a guided breathing session", Component: BreathingBlock },
};
