import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { AREAS, PRESETS } from "../../engine/index.ts";
import { archiveHabit } from "../../db/repo.ts";
import type { EditorSeed } from "./HabitEditor.tsx";

/** The Codex: installed directives + the library, merged, searchable,
 *  categorized by area — one popout to manage the whole loadout. */
export function DirectiveCodex({
  onSeed,
  onClose,
}: {
  onSeed: (seed: EditorSeed) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archivedAt).toArray(), []);
  const installed = new Set((habits ?? []).map((h) => h.presetId).filter(Boolean));
  const query = q.trim().toLowerCase();

  const matches = (name: string) => !query || name.toLowerCase().includes(query);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal editor"
        role="dialog"
        aria-modal="true"
        aria-label="Directive codex"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <h2 className="card-title">Directive Codex</h2>
          <button className="link-btn" onClick={onClose}>
            close
          </button>
        </div>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search directives + library…"
          aria-label="Search directives"
          autoFocus
        />
        {[undefined, ...AREAS.map((a) => a.id)].map((areaId) => {
          const areaDef = AREAS.find((a) => a.id === areaId);
          const mine = (habits ?? []).filter((h) => (h.area ?? undefined) === areaId && matches(h.name));
          const presets = PRESETS.filter(
            (p) => (areaId ? p.area === areaId : false) && !installed.has(p.presetId) && matches(p.name),
          );
          if (mine.length === 0 && presets.length === 0) return null;
          return (
            <div key={areaId ?? "none"}>
              <h3 className="card-title" style={{ marginTop: 12 }}>
                {areaDef ? `${areaDef.icon} ${areaDef.name}` : "◈ Unsorted"}
              </h3>
              {mine.map((h) => (
                <div className="row-item" key={h.id}>
                  <span>
                    {h.icon} {h.name}
                    <span className="off-day-tag">
                      {h.charge && h.charge > 1 ? ` · ${"⚡".repeat(h.charge)}` : ""}
                      {h.reminderTime ? ` · 🔔${h.reminderTime}` : ""}
                      {h.pings ? ` · 🔔×${h.pings.times}` : ""}
                    </span>
                  </span>
                  <span className="row-actions">
                    <button className="link-btn" onClick={() => onSeed({ habit: h })}>
                      edit
                    </button>
                    <button className="link-btn" onClick={() => archiveHabit(h.id)}>
                      archive
                    </button>
                  </span>
                </div>
              ))}
              {presets.map((p) => (
                <div className="row-item" key={p.presetId}>
                  <span>
                    {p.icon} {p.name}
                    <span className="off-day-tag"> · library</span>
                  </span>
                  <button
                    className="link-btn"
                    onClick={() =>
                      onSeed({
                        name: p.name, icon: p.icon, area: p.area, schedule: p.schedule,
                        timeOfDay: p.timeOfDay, reminderTime: p.suggestedReminder, presetId: p.presetId,
                      })
                    }
                  >
                    install
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
