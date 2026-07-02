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

// Add a habit in System.
await page.getByRole("button", { name: "System" }).click();
await page.getByLabel("Habit name").fill("Hydrocheck");
await page.getByRole("button", { name: "Install directive" }).click();
await page.waitForTimeout(300);

// Log it on Today + add water.
await page.getByRole("button", { name: "Today" }).click();
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
if (!water || !water.startsWith("500 /")) fail(`water total wrong after reload: "${water}"`);

console.log("persist check OK — habit + 500ml water survived reload");
await browser.close();
await server.close();
process.exit(0);
