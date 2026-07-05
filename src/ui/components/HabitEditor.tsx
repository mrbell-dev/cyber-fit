import { useState } from "react";
import {
  AREAS,
  type Area,
  type Habit,
  type Schedule,
  type TimeOfDay,
} from "../../engine/index.ts";
import { addHabit, updateHabit } from "../../db/repo.ts";
import { syncPush } from "../notify.ts";

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

        <div className="editor-row">
          <span className="editor-row-label">Area</span>
          <div className="chip-row" role="group" aria-label="Area of focus">
            {AREAS.map((a) => (
              <button
                key={a.id}
                className={area === a.id ? "chip on" : "chip"}
                aria-pressed={area === a.id}
                onClick={() => setArea(area === a.id ? undefined : a.id)}
              >
                {a.icon} {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Schedule</span>
          <div className="chip-row" role="group" aria-label="Schedule">
            <button
              className={schedule.kind === "daily" ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "daily" })}
            >
              Daily
            </button>
            <button
              className={schedule.kind === "weekdays" ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "weekdays", days: days.length ? days : [1, 2, 3, 4, 5] })}
            >
              Specific days
            </button>
            <button
              className={schedule.kind === "timesPerWeek" ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "timesPerWeek", target: 3 })}
            >
              N per week
            </button>
            <button
              className={nPerX && nPerX.periodDays === 7 && nPerX.times === 1 ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "nPerX", times: 1, periodDays: 7 })}
            >
              Weekly
            </button>
            <button
              className={nPerX && nPerX.periodDays === 30 ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "nPerX", times: 1, periodDays: 30 })}
            >
              Monthly
            </button>
            <button
              className={nPerX && nPerX.periodDays === 365 ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "nPerX", times: 1, periodDays: 365 })}
            >
              Yearly
            </button>
            <button
              className={nPerX && ![7, 30, 365].includes(nPerX.periodDays) ? "chip on" : "chip"}
              onClick={() => setSchedule({ kind: "nPerX", times: 2, periodDays: 10 })}
            >
              N per X days
            </button>
          </div>
          {nPerX && (
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
            className="input"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            placeholder="after I pour my morning coffee…"
            aria-label="Anchor routine"
          />
          <p className="placeholder">// "after X, I do Y" — the best-proven habit trick there is</p>
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Charge — how hard is this for YOU?</span>
          <div className="chip-row" role="group" aria-label="Charge">
            {[1, 2, 3, 4, 5].map((c) => (
              <button
                key={c}
                className={charge === c ? "chip on" : "chip"}
                aria-pressed={charge === c}
                onClick={() => setCharge(c)}
              >
                {"⚡".repeat(c)}
              </button>
            ))}
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
