import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  AREAS,
  PRESETS,
  type Area,
  type Habit,
  type Preset,
  type Schedule,
  type TimeOfDay,
} from "../../engine/index.ts";
import { addHabit, updateHabit } from "../../db/repo.ts";
import { syncPush } from "../notify.ts";

// Schedule kinds as a flat option list (dropdown) — the sub-controls
// (weekday toggles / N-per-X inputs) still render below the selected kind.
type SchedOpt = "daily" | "weekdays" | "timesPerWeek" | "weekly" | "monthly" | "yearly" | "nPerX";
const SCHED_LABELS: { id: SchedOpt; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Specific days" },
  { id: "timesPerWeek", label: "N times per week" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "nPerX", label: "N per X days (rolling)" },
];
function schedOptOf(s: Schedule): SchedOpt {
  if (s.kind === "daily") return "daily";
  if (s.kind === "weekdays") return "weekdays";
  if (s.kind === "timesPerWeek") return "timesPerWeek";
  if (s.times === 1 && s.periodDays === 7) return "weekly";
  if (s.times === 1 && s.periodDays === 30) return "monthly";
  if (s.times === 1 && s.periodDays === 365) return "yearly";
  return "nPerX";
}
const SCHED_FACTORY: Record<SchedOpt, () => Schedule> = {
  daily: () => ({ kind: "daily" }),
  weekdays: () => ({ kind: "weekdays", days: [1, 2, 3, 4, 5] }),
  timesPerWeek: () => ({ kind: "timesPerWeek", target: 3 }),
  weekly: () => ({ kind: "nPerX", times: 1, periodDays: 7 }),
  monthly: () => ({ kind: "nPerX", times: 1, periodDays: 30 }),
  yearly: () => ({ kind: "nPerX", times: 1, periodDays: 365 }),
  nPerX: () => ({ kind: "nPerX", times: 2, periodDays: 10 }),
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const TIMES: { id: TimeOfDay; name: string; icon: string }[] = [
  { id: "morning", name: "Morning", icon: "🌅" },
  { id: "day", name: "Day", icon: "☀️" },
  { id: "evening", name: "Evening", icon: "🌆" },
  { id: "anytime", name: "Anytime", icon: "∞" },
];

const EMOJI_SUGGESTIONS = ["⚡", "🧘", "🦾", "📖", "🧠", "🚶", "🥗", "🌙", "🫁", "💊", "🎸", "🐣"];

// The web can't switch the OS keyboard to emoji, so we ship our own picker.
const EMOJI_GRID = [
  "⚡", "🔥", "💪", "🦾", "🦿", "🧠", "🫀", "🫁", "👁️", "🤖", "👾", "🕶️",
  "🧘", "🏃", "🚶", "🏋️", "🤸", "🚴", "🏊", "🥊", "⛰️", "🧗", "🛹", "⚽",
  "📖", "📚", "✍️", "🎓", "🧪", "💻", "🎯", "♟️", "🧩", "🎨", "🎸", "🎹",
  "🥗", "🍎", "🥦", "🍳", "🥑", "🍵", "💧", "🚰", "☕", "🥤", "🍽️", "🧂",
  "🌙", "😴", "🛏️", "🌅", "☀️", "🌆", "🌃", "⭐", "🌧️", "🌿", "🌵", "🌸",
  "💊", "🩺", "🦷", "🧼", "🛁", "🧴", "❤️", "💚", "💜", "🖤", "✨", "🐣",
  "🦎", "🐕", "🐈", "🌊", "🔋", "📵", "🎮", "🗡️", "🛡️", "💾", "📡", "🔧",
];

export interface EditorSeed {
  habit?: Habit; // present = editing
  // preset fields for "install from library" (or blank for brand-new)
  name?: string;
  icon?: string;
  area?: Area;
  schedule?: Schedule;
  timeOfDay?: TimeOfDay;
  reminderTime?: string;
  presetId?: string;
}

/** Finch-style single-card editor: the directive is one object — name, emoji,
 *  area, schedule, time of day, and its notification — created together. */
export function HabitEditor({ seed, onClose }: { seed: EditorSeed; onClose: () => void }) {
  const h = seed.habit;
  const [name, setName] = useState(h?.name ?? seed.name ?? "");
  const [icon, setIcon] = useState(h?.icon ?? seed.icon ?? "⚡");
  const [area, setArea] = useState<Area | undefined>(h?.area ?? seed.area);
  const [schedule, setSchedule] = useState<Schedule>(h?.schedule ?? seed.schedule ?? { kind: "daily" });
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(h?.timeOfDay ?? seed.timeOfDay ?? "anytime");
  const [remindOn, setRemindOn] = useState(Boolean(h?.reminderTime || h?.pings));
  const [reminderTime, setReminderTime] = useState(
    h?.reminderTime ?? h?.pings?.start ?? seed.reminderTime ?? "18:00",
  );
  const [pingTimes, setPingTimes] = useState(h?.pings?.times ?? 1);
  const [pingEnd, setPingEnd] = useState(h?.pings?.end ?? "21:00");
  const [untilDone, setUntilDone] = useState(h?.pings?.untilDone ?? false);
  const [charge, setCharge] = useState(h?.charge ?? 1);
  const [anchor, setAnchor] = useState(h?.anchor ?? "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const applyPreset = (p: Preset) => {
    setName(p.name);
    setIcon(p.icon);
    setArea(p.area);
    setSchedule(p.schedule);
    setTimeOfDay(p.timeOfDay);
    if (p.suggestedReminder) setReminderTime(p.suggestedReminder);
    setSuggestOpen(false);
  };

  // Anchor suggestions = the user's OWN active directives (minus this one).
  const anchorOptions = useLiveQuery(async () => {
    const all = await db.habits.filter((x) => !x.archivedAt).toArray();
    return all.filter((x) => x.id !== h?.id).map((x) => x.name);
  }, [h?.id]);
  // Master notification switch — off hides ping options entirely.
  const notifOn = useLiveQuery(async () => {
    const row = await db.kv.get("reminders");
    return (row?.value as { enabled?: boolean } | undefined)?.enabled !== false;
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    const multi = remindOn && (pingTimes > 1 || untilDone);
    const fields = {
      name: name.trim(),
      icon: icon || "⚡",
      schedule,
      area,
      timeOfDay,
      charge,
      anchor: anchor.trim() || undefined,
      reminderTime: remindOn && !multi ? reminderTime : undefined,
      pings: multi
        ? { times: pingTimes, start: reminderTime, end: pingTimes > 1 ? pingEnd : reminderTime, untilDone }
        : undefined,
      domain: area === "learning" ? ("learning" as const) : ("general" as const),
    };
    if (h) await updateHabit(h.id, fields);
    else await addHabit({ ...fields, presetId: seed.presetId });
    await syncPush();
    onClose();
  };

  const days = schedule.kind === "weekdays" ? schedule.days : [];
  const nPerX = schedule.kind === "nPerX" ? schedule : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal editor"
        role="dialog"
        aria-modal="true"
        aria-label={h ? "Edit directive" : "New directive"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="editor-icon-row">
          <input
            className="input editor-icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            aria-label="Emoji"
            maxLength={4}
          />
          <div className="emoji-strip" role="group" aria-label="Emoji suggestions">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button key={e} className="emoji-pick" onClick={() => setIcon(e)} aria-label={`Use ${e}`}>
                {e}
              </button>
            ))}
            <button
              className={emojiOpen ? "emoji-pick more on" : "emoji-pick more"}
              onClick={() => setEmojiOpen(!emojiOpen)}
              aria-expanded={emojiOpen}
              aria-label={emojiOpen ? "Close emoji picker" : "More emoji"}
            >
              …
            </button>
          </div>
        </div>

        {emojiOpen && (
          <div className="emoji-grid" role="group" aria-label="Emoji picker">
            {EMOJI_GRID.map((e) => (
              <button
                key={e}
                className="emoji-pick"
                onClick={() => {
                  setIcon(e);
                  setEmojiOpen(false);
                }}
                aria-label={`Use ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <input
          className="input editor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name the directive…"
          aria-label="Directive name"
          autoFocus={!h}
        />

        {!h && (
          <button className="link-btn" onClick={() => setSuggestOpen(true)}>
            💡 Need ideas? Browse suggestions
          </button>
        )}
        {suggestOpen && (
          <div className="overlay" onClick={() => setSuggestOpen(false)}>
            <div
              className="modal editor"
              role="dialog"
              aria-modal="true"
              aria-label="Directive suggestions"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <h2 className="card-title">Suggestions</h2>
                <button className="link-btn" onClick={() => setSuggestOpen(false)}>
                  close
                </button>
              </div>
              <p className="placeholder">// tap one to fill the form — tweak anything after</p>
              {PRESETS.map((p) => (
                <button key={p.presetId} className="suggest-item" onClick={() => applyPreset(p)}>
                  <span>{p.icon} {p.name}</span>
                  <span className="off-day-tag">{AREAS.find((a) => a.id === p.area)?.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="editor-row">
          <span className="editor-row-label">Area</span>
          <select
            className="input anchor-input"
            value={area ?? ""}
            onChange={(e) => setArea((e.target.value || undefined) as Area | undefined)}
            aria-label="Area of focus"
          >
            <option value="">No area</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Schedule</span>
          <select
            className="input anchor-input"
            value={schedOptOf(schedule)}
            onChange={(e) => setSchedule(SCHED_FACTORY[e.target.value as SchedOpt]())}
            aria-label="Schedule"
          >
            {SCHED_LABELS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {nPerX && schedOptOf(schedule) === "nPerX" && (
            <label className="check-label">
              <input
                type="number"
                className="input num-input-sm"
                min={1}
                max={99}
                value={nPerX.times}
                onChange={(e) =>
                  setSchedule({ ...nPerX, times: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })
                }
                aria-label="Times"
              />
              times every
              <input
                type="number"
                className="input num-input-sm"
                min={2}
                max={365}
                value={nPerX.periodDays}
                onChange={(e) =>
                  setSchedule({ ...nPerX, periodDays: Math.max(2, Math.min(365, Number(e.target.value) || 7)) })
                }
                aria-label="Days in period"
              />
              days (rolling window)
            </label>
          )}
          {schedule.kind === "weekdays" && (
            <div className="chip-row" role="group" aria-label="Days of week">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  className={days.includes(i) ? "day-toggle sm on" : "day-toggle sm"}
                  aria-pressed={days.includes(i)}
                  onClick={() =>
                    setSchedule({
                      kind: "weekdays",
                      days: days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort(),
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {schedule.kind === "timesPerWeek" && (
            <label className="check-label">
              <input
                type="number"
                className="input num-input-sm"
                min={1}
                max={7}
                value={schedule.target}
                onChange={(e) =>
                  setSchedule({ kind: "timesPerWeek", target: Math.max(1, Math.min(7, Number(e.target.value) || 3)) })
                }
                aria-label="Days per week"
              />
              days a week — any days count
            </label>
          )}
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Anchor — ride an existing routine (optional)</span>
          <input
            className="input anchor-input"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            placeholder="pick a directive, or type your own trigger…"
            aria-label="Anchor routine"
            list="anchor-options"
          />
          <datalist id="anchor-options">
            {(anchorOptions ?? []).map((n) => (
              <option key={n} value={`after ${n}`} />
            ))}
          </datalist>
          <p className="placeholder">// "after X, I do Y" — the best-proven habit trick there is</p>
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Charge — how hard is this for YOU?</span>
          <div className="slider-row">
            <input
              type="range"
              className="charge-slider"
              min={1}
              max={5}
              step={1}
              value={charge}
              onChange={(e) => setCharge(Number(e.target.value))}
              aria-label="Charge, 1 to 5"
              aria-valuetext={`${charge} of 5`}
            />
            <span className="charge-readout" aria-hidden="true">{"⚡".repeat(charge)}</span>
          </div>
          <p className="placeholder">// XP scales with charge — your boss fight, your rules</p>
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Time of day</span>
          <div className="chip-row" role="group" aria-label="Time of day">
            {TIMES.map((t) => (
              <button
                key={t.id}
                className={timeOfDay === t.id ? "chip on" : "chip"}
                aria-pressed={timeOfDay === t.id}
                onClick={() => setTimeOfDay(t.id)}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        </div>

        {notifOn === false ? (
          <div className="editor-row">
            <p className="placeholder">// notifications are globally off — turn them on in Reminder Uplink (SYSTEM) to set pings</p>
          </div>
        ) : (
        <div className="editor-row">
          <label className="check-label">
            <input type="checkbox" checked={remindOn} onChange={(e) => setRemindOn(e.target.checked)} />
            Ping me
            {!remindOn && <span className="off-day-tag">optional — off by default</span>}
          </label>
          {remindOn && (
            <>
              <label className="check-label">
                <input
                  type="number"
                  className="input num-input-sm"
                  min={1}
                  max={10}
                  value={pingTimes}
                  onChange={(e) => setPingTimes(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  aria-label="Pings per day"
                />
                ×/day, {pingTimes > 1 ? "between" : "at"}
                <input
                  type="time"
                  className="input time-input"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  aria-label={pingTimes > 1 ? "Ping window start" : "Reminder time"}
                />
                {pingTimes > 1 && (
                  <>
                    –
                    <input
                      type="time"
                      className="input time-input"
                      value={pingEnd}
                      onChange={(e) => setPingEnd(e.target.value)}
                      aria-label="Ping window end"
                    />
                  </>
                )}
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={untilDone}
                  onChange={(e) => setUntilDone(e.target.checked)}
                />
                quiet in-app nudges once it's done for the day
              </label>
              <p className="placeholder">
                // fires on scheduled days only. push pings stay generic and schedule-blind —
                the relay never learns whether you completed anything
              </p>
            </>
          )}
        </div>
        )}

        <div className="install-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={!name.trim()}>
            {h ? "Save changes" : "Install directive"}
          </button>
        </div>
      </div>
    </div>
  );
}
