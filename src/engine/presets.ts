// Directive Library — default directives users can install/remove one by one.
// Each is a complete object: name, emoji, area, schedule, time of day, and
// (optional) baked-in notification default. All reminders default OFF — the
// user turns them on; the app never nags uninvited.

import type { Area, Schedule, TimeOfDay } from "./types.ts";

export interface Preset {
  presetId: string;
  name: string;
  icon: string;
  area: Area;
  schedule: Schedule;
  timeOfDay: TimeOfDay;
  /** suggested reminder time shown pre-filled (but OFF) in the editor */
  suggestedReminder?: string;
}

export const PRESETS: Preset[] = [
  { presetId: "survive", name: "Literally survive the day", icon: "🐣", area: "health",
    schedule: { kind: "daily" }, timeOfDay: "anytime" },
  { presetId: "grounding", name: "Grounding ritual — 10 min offline", icon: "🧘", area: "grounding",
    schedule: { kind: "daily" }, timeOfDay: "evening", suggestedReminder: "20:00" },
  { presetId: "stretch", name: "Morning stretch", icon: "🦾", area: "body",
    schedule: { kind: "daily" }, timeOfDay: "morning", suggestedReminder: "08:15" },
  { presetId: "walk", name: "Touch grass — walk outside", icon: "🚶", area: "grounding",
    schedule: { kind: "daily" }, timeOfDay: "day" },
  { presetId: "read", name: "Feed the wetware — read", icon: "📖", area: "learning",
    schedule: { kind: "timesPerWeek", target: 3 }, timeOfDay: "evening" },
  { presetId: "learn", name: "Learn one new thing", icon: "🧠", area: "learning",
    schedule: { kind: "daily" }, timeOfDay: "anytime" },
  { presetId: "veg", name: "Eat a real vegetable", icon: "🥗", area: "nutrition",
    schedule: { kind: "daily" }, timeOfDay: "day" },
  { presetId: "lightsout", name: "Lights out on time", icon: "🌙", area: "sleep",
    schedule: { kind: "daily" }, timeOfDay: "evening", suggestedReminder: "22:30" },
  { presetId: "breathe", name: "Box breathing — 2 min", icon: "🫁", area: "mind",
    schedule: { kind: "daily" }, timeOfDay: "anytime" },
];
