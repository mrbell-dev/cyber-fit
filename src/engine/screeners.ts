// PHQ-9 and GAD-7 — public-domain screening instruments (Pfizer released both
// to the public domain; no license needed). These are SCREENERS, not
// diagnoses — the UI must say so, and results exist to show trends to the
// user's actual care team via the Trauma Team export.

export interface ScreenerDef {
  tool: "phq9" | "gad7";
  name: string;
  prompt: string;
  items: string[];
  /** [minScore, label] bands, checked in order */
  bands: [number, string][];
  maxScore: number;
}

export const SCREENER_OPTIONS = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
];

export const SCREENERS: ScreenerDef[] = [
  {
    tool: "phq9",
    name: "PHQ-9 (depression screener)",
    prompt: "Over the last 2 weeks, how often have you been bothered by…",
    items: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      "Trouble concentrating on things, such as reading or watching television",
      "Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
      "Thoughts that you would be better off dead, or of hurting yourself in some way",
    ],
    bands: [
      [20, "severe"],
      [15, "moderately severe"],
      [10, "moderate"],
      [5, "mild"],
      [0, "minimal"],
    ],
    maxScore: 27,
  },
  {
    tool: "gad7",
    name: "GAD-7 (anxiety screener)",
    prompt: "Over the last 2 weeks, how often have you been bothered by…",
    items: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it's hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ],
    bands: [
      [15, "severe"],
      [10, "moderate"],
      [5, "mild"],
      [0, "minimal"],
    ],
    maxScore: 21,
  },
];

export function scoreBand(def: ScreenerDef, score: number): string {
  for (const [min, label] of def.bands) if (score >= min) return label;
  return "minimal";
}

/** PHQ-9 item 9 is the self-harm item — any non-zero answer must surface
 *  crisis resources immediately, without drama and without judgment. */
export function needsCrisisResources(tool: "phq9" | "gad7", answers: number[]): boolean {
  return tool === "phq9" && (answers[8] ?? 0) > 0;
}
