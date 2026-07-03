import { useState } from "react";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Shields ▣",
    body: "Every 5 active days banks a shield (max 3). Miss a day and a shield absorbs it silently — your streak holds. Run out and the streak reboots to zero, but that's a reboot, not a failure. The app never counts what you missed.",
  },
  {
    title: "Charge ⚡",
    body: "Each directive carries a charge (1–5⚡) that YOU set: how hard is this for you? XP scales with it. Drinking water can be someone's boss fight and someone else's freebie — the app doesn't decide, you do.",
  },
  {
    title: "XP, levels & crits",
    body: "Logging earns XP (each source has a daily cap, so nothing is grindable). ~15% of grants CRIT for double. ~4% drop a data shard that unlocks a cosmetic augment. Difficulty (System → Config) reshapes the level curve — cosmetics only, never features.",
  },
  {
    title: "#tags",
    body: "Type #tags in workout names, notes, highlights, journal entries, vitals notes. The Tag Explorer (Stats) intersects them: select #lift and #workout to see only entries carrying both.",
  },
  {
    title: "Off-grid & privacy",
    body: "Everything you log lives on this device. The app works fully offline forever. Push reminders are opt-in; the relay stores only an anonymous push address and time slots — never your data, schedule meanings, or identity.",
  },
  {
    title: "Bio-scan cadence",
    body: "Weigh-ins reward YOUR chosen rhythm (daily to bimonthly). Scanning more often than your cadence is allowed but earns nothing — fluctuations are noise, the trend is the signal.",
  },
  {
    title: "Gigs vs directives",
    body: "Directives are habits — they build streaks. Gigs are one-off jobs; unfinished ones quietly carry over to the next day, bullet-journal style. No streaks, no guilt.",
  },
];

export function FieldManual() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="card">
      <h2 className="card-title">Field Manual</h2>
      {SECTIONS.map((s, i) => (
        <div key={s.title}>
          <button className="row-item manual-row" onClick={() => setOpen(open === i ? null : i)}>
            <span>{s.title}</span>
            <span className="off-day-tag">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <p className="placeholder">// {s.body}</p>}
        </div>
      ))}
    </div>
  );
}
