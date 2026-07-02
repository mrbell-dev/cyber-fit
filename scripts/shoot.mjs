// Build + screenshot each tab at phone size → ./shots. Visual verification for UI work.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

mkdirSync("shots", { recursive: true });

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });

const tabs = ["Today", "Log", "Stats", "System"];
for (const tab of tabs) {
  await page.getByRole("button", { name: tab }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/${tab.toLowerCase()}.png` });
  console.log(`wrote shots/${tab.toLowerCase()}.png`);
}

await browser.close();
await server.close();
process.exit(0);
