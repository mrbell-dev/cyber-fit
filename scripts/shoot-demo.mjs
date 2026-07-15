#!/usr/bin/env node
// Demo screenshot pipeline: serves the built app via vite preview, walks
// first-run onboarding, imports the generated demo profile through the real
// System → Import backup path, then captures docs/guide/img/*.png at 390×844.
// Run with `npm run shoot:demo` (builds dist first). Distinct from the
// marketing pipeline in shots/ — do not merge the two.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";
import { buildDemoExport } from "./seed-demo.mjs";

const OUT = "docs/guide/img";
const PORT = 4179; // shoot.mjs owns 4173, persist-check.mjs owns 4174

mkdirSync(OUT, { recursive: true });
const profilePath = join(tmpdir(), "cyber-fit-demo-profile.json");
writeFileSync(profilePath, JSON.stringify(buildDemoExport(), null, 2));

const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

let shot = 0;
const snap = async (name) => {
  await page.waitForTimeout(300); // let live queries and fonts settle
  // XP toasts auto-dismiss after 3.5s; importing the demo profile emits
  // grants, so early shots race them. Wait for the stack to clear (bounded,
  // in case a screen keeps re-toasting) so no screenshot ships with toasts.
  await page
    .locator(".toast-stack")
    .waitFor({ state: "detached", timeout: 8000 })
    .catch(() => {});
  shot += 1;
  const file = `${String(shot).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(file);
};
const nav = async (name) => {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name, exact: true })
    .click();
};

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

// Fresh browser context always sees first-run onboarding; click through it.
// (The starter habits it creates are wiped by the import below.)
await page.getByRole("button", { name: "Begin calibration" }).click();
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByRole("button", { name: "Jack in" }).click();

// Import the demo profile through the app's real import path.
await nav("System");
await page.getByLabel("Import backup file").setInputFiles(profilePath);
await page.getByText("Backup restored").waitFor();

// Base shot of every screen.
await nav("Directives");
await snap("today");
await nav("Training");
await snap("training");
await nav("Bio");
await snap("bio");
await nav("Feed");
await snap("feed");
await nav("Goals");
await snap("goals");
await nav("Telemetry");
await snap("telemetry");
await nav("System");
await snap("system");

// Interaction states: nav drawer open, then the crash kit overlay.
// Reload between them — cheapest deterministic way to dismiss the drawer,
// and safe because all state lives in IndexedDB.
await nav("Directives");
await page.getByRole("button", { name: "Open menu" }).click();
await snap("menu");
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open crash kit" }).click();
await snap("crash-kit");

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
console.log(`done — ${shot} screenshots in ${OUT}/`);
