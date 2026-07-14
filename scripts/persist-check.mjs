// End-to-end: add a habit, log it, add water, reload — everything must survive.
import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4174, strictPort: true } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const fail = (msg) => {
  console.error("PERSIST CHECK FAILED —", msg);
  process.exit(1);
};

await page.goto("http://localhost:4174/", { waitUntil: "networkidle" });

// First-run onboarding overlays Today and intercepts clicks — set the kv flag
// the way the app does, then reload so the liveQuery picks it up.
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
// Daily boot greeting shows once onboarded — dismiss it so it can't
// intercept clicks (its button also persists lastBootDay in kv).
const jackIn = page.getByRole("button", { name: "Jack in" });
if (await jackIn.count()) {
  await jackIn.click();
  await page.waitForTimeout(200);
}

// Nav lives in a drawer since Slice 2 — open it via the header hamburger first.
const nav = async (name) => {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name, exact: true }).click();
};

// Add a habit in System.
await nav("System");
await page.getByRole("button", { name: "+ New directive" }).click();
await page.getByLabel("Directive name").fill("Hydrocheck");
await page.getByRole("button", { name: "Install directive" }).click();
await page.waitForTimeout(300);

// Log it on Today + add water.
await nav("Directives");
await page.getByRole("button", { name: /Hydrocheck/ }).first().click();
await page.getByRole("button", { name: "+250" }).click();
await page.getByRole("button", { name: "+250" }).click();
await page.waitForTimeout(300);

// Reload and verify.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);

const habit = page.getByRole("button", { name: /Hydrocheck/ }).first();
if ((await habit.getAttribute("aria-pressed")) !== "true") fail("habit not done after reload");

const water = await page.textContent(".water-label");
if (!water || !water.startsWith("500 ml /")) fail(`water total wrong after reload: "${water}"`);

console.log("persist check OK — habit + 500ml water survived reload");
await browser.close();
await server.close();
process.exit(0);
