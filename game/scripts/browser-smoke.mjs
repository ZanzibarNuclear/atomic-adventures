import { chromium } from "playwright";

const baseUrl = process.env.GAME_URL ?? "http://127.0.0.1:5173/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const logs = [];
page.on("console", (message) => logs.push({ type: message.type(), text: message.text() }));
page.on("pageerror", (error) => logs.push({ type: "pageerror", text: error.message }));

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });

  await page.getByRole("button", { name: /Storyline/i }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Storyline/i }).click();
  await page.locator(".story-objective").waitFor({ timeout: 10_000 });
  await page.getByText("Origin", { exact: true }).waitFor({ timeout: 10_000 });

  const text = await page.locator("body").innerText();
  const errorLogs = logs.filter((entry) => entry.type === "error" || entry.type === "pageerror");
  if (errorLogs.length) {
    throw new Error(`Browser console errors:\n${JSON.stringify(errorLogs, null, 2)}`);
  }
  const found = {
    objective: text.includes("Keep moving. Find something that can help you survive."),
    mapCaption: text.includes("Origin"),
  };
  if (!found.objective || !found.mapCaption) {
    throw new Error(`Missing expected browser smoke text:\n${JSON.stringify(found, null, 2)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    url: baseUrl,
    found,
  }, null, 2));
} finally {
  await browser.close();
}
