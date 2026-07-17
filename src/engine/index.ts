// The ONLY public surface of the engine. UI and db import from here — never from
// individual engine modules. Keep the engine pure: no DOM, no IO, no Date.now(),
// no Math.random() (clock and RNG are injected via ctx).

export * from "./time.ts";
export * from "./types.ts";
export * from "./habits.ts";
export * from "./goals.ts";
export * from "./gigs.ts";
export * from "./water.ts";
export * from "./rng.ts";
export * from "./rewards.ts";
export * from "./rebuild.ts";
export * from "./reading.ts";
export * from "./reminders.ts";
export * from "./presets.ts";
export * from "./exercises.ts";
export * from "./tags.ts";
export * from "./screeners.ts";
export * from "./trend.ts";
export { medWindow, type MedWindow } from "./meds.ts";
