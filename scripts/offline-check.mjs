// Prove the service worker precache works: load once online, go offline, reload.
import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
// Give the SW time to install + precache.
await page.waitForTimeout(2500);

await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

const title = await page.textContent(".app-title");
if (!title || !title.includes("CYBER")) {
  console.error("OFFLINE CHECK FAILED — app did not render offline");
  process.exit(1);
}
console.log("offline check OK — app renders with network disabled");

await browser.close();
await server.close();
process.exit(0);
