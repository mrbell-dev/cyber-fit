// Prove the Data Vault round-trip: seed data → export → wipe DB → import → identical state.
import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4177, strictPort: true } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const fail = (msg) => {
  console.error("VAULT CHECK FAILED —", msg);
  process.exit(1);
};

// First-run onboarding overlays Today and intercepts clicks — set the kv flag
// the way the app does, then reload so the liveQuery picks it up.
const dismissOnboarding = async () => {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("cyber-fit");
        req.onsuccess = () => {
          const idb = req.result;
          const tx = idb.transaction("kv", "readwrite");
          tx.objectStore("kv").put({ key: "onboarded", value: true });
          tx.oncomplete = () => {
            idb.close();
            resolve(null);
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
};

await page.goto("http://localhost:4177/", { waitUntil: "networkidle" });
await dismissOnboarding();

// Seed: habit + log + water + workout + goal.
await page.getByRole("button", { name: "System" }).click();
await page.getByRole("button", { name: "+ New directive" }).click();
await page.getByLabel("Directive name").fill("Vault test");
await page.getByRole("button", { name: "Install directive" }).click();
await page.getByRole("button", { name: "Today" }).click();
await page.getByRole("button", { name: /Vault test/ }).first().click();
await page.getByRole("button", { name: "+500" }).click();
await page.getByRole("button", { name: "Log", exact: true }).click();
await page.getByLabel("Workout name").fill("Deadlifts");
await page.getByRole("button", { name: "Log workout" }).click();
await page.getByRole("button", { name: "Stats" }).click();
await page.getByRole("button", { name: "New goal" }).click();
await page.getByLabel("Goal name").fill("Vault goal");
await page.getByRole("button", { name: "Set goal" }).click();
await page.waitForTimeout(400);

// Export (capture the download).
await page.getByRole("button", { name: "System" }).click();
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export backup" }).click(),
]);
const path = await download.path();

// Wipe the database entirely.
await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase("cyber-fit");
  req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
}));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
await dismissOnboarding();

// Confirm it's actually gone.
await page.getByRole("button", { name: "Today" }).click();
if (await page.getByRole("button", { name: /Vault test/ }).count()) fail("wipe did not clear data");

// Import.
await page.getByRole("button", { name: "System" }).click();
await page.locator('input[type="file"]').setInputFiles(path);
await page.waitForTimeout(1200);
const sysText = await page.textContent("body");
if (!sysText.includes("Backup restored")) {
  fail(`import message missing — page says: ${sysText.match(/\/\/ .*/)?.[0] ?? "(no message)"}`);
}

// Verify everything came back.
await page.getByRole("button", { name: "Today" }).click();
const habit = page.getByRole("button", { name: /Vault test/ }).first();
if ((await habit.getAttribute("aria-pressed")) !== "true") fail("habit state lost");
const water = await page.textContent(".water-label");
if (!/^500\b/.test(water ?? "")) fail(`water lost: ${water}`);
await page.getByRole("button", { name: "Log", exact: true }).click();
await page.waitForTimeout(500);
if (!(await page.textContent("body")).includes("Deadlifts")) fail("workout lost");
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(500);
if (!(await page.textContent("body")).includes("Vault goal")) fail("goal lost");

console.log("vault check OK — export → wipe → import round-trip identical (incl. goals)");
await browser.close();
await server.close();
process.exit(0);
