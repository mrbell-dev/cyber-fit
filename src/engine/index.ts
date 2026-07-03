// The ONLY public surface of the engine. UI and db import from here — never from
// individual engine modules. Keep the engine pure: no DOM, no IO, no Date.now(),
// no Math.random() (clock and RNG are injected via ctx).

export * from "./time.ts";
export * from "./types.ts";
export * from "./habits.ts";
export * from "./water.ts";
export * from "./rng.ts";
export * from "./rewards.ts";
export * from "./rebuild.ts";
export * from "./reading.ts";
export * from "./reminders.ts";
export * from "./presets.ts";
export * from "./exercises.ts";
