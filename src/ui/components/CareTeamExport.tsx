import { useState } from "react";
import { buildReport, DEFAULT_SECTIONS, downloadReport, type ReportSections } from "../../db/report.ts";

const SECTION_LABELS: { key: keyof ReportSections; label: string }[] = [
  { key: "vitals", label: "Mood readings" },
  { key: "journals", label: "Journal entries" },
  { key: "highlights", label: "Daily highlights" },
  { key: "workouts", label: "Physical activity" },
  { key: "bio", label: "Bio measurements (weight, BP…)" },
  { key: "hydration", label: "Hydration" },
  { key: "reading", label: "Reading / learning" },
];

/** Export a clean .md for a therapist/doctor — sections per audience:
 *  the doctor gets bio measurements, the therapist doesn't have to. */
export function CareTeamExport() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(14);
  const [sections, setSections] = useState<ReportSections>(DEFAULT_SECTIONS);
  const [done, setDone] = useState(false);

  const generate = async () => {
    downloadReport(await buildReport(days, sections), days);
    setDone(true);
  };

  return (
    <div className="card">
      <h2 className="card-title">Care-Team Export</h2>
      <p className="placeholder">
        // a clean summary of your last weeks for a therapist or doctor — pick
        what each of them gets to see. plain professional english, no slang
      </p>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>
          Prepare export
        </button>
      ) : (
        <>
          <div className="chip-row" role="group" aria-label="Period">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className={days === d ? "chip on" : "chip"}
                aria-pressed={days === d}
                onClick={() => setDays(d)}
              >
                last {d} days
              </button>
            ))}
          </div>
          {SECTION_LABELS.map(({ key, label }) => (
            <label className="check-label" key={key}>
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={(e) => setSections({ ...sections, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <div className="form-row">
            <button className="btn" onClick={generate}>
              Generate .md
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {done && <p className="placeholder">// downloaded — attach it to an email or print it</p>}
        </>
      )}
    </div>
  );
}
