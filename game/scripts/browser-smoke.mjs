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

  await page.getByRole("button", { name: /Story\b/i }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Story\b/i }).click();
  await page.locator(".story-objective").waitFor({ timeout: 10_000 });
  await page.getByText("Origin", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /^(Go west|Keep walking west)$/ }).waitFor({ timeout: 10_000 });
  const openingText = await page.locator("body").innerText();
  await page.getByRole("button", { name: /^(Go west|Keep walking west)$/ }).click();
  await page.getByText("East Pines", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Continue west" }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Go east" }).waitFor({ timeout: 10_000 });

  const text = await page.locator("body").innerText();
  const actionClasses = await page.locator("button.route-btn").evaluateAll((buttons) =>
    buttons.map((button) => ({
      label: button.textContent?.trim(),
      className: button.className,
    })),
  );
  const errorLogs = logs.filter((entry) => entry.type === "error" || entry.type === "pageerror");
  if (errorLogs.length) {
    throw new Error(`Browser console errors:\n${JSON.stringify(errorLogs, null, 2)}`);
  }
  const found = {
    objective: openingText.includes("Keep moving. Find something that can help you survive."),
    openingMapCaption: openingText.includes("Origin"),
    detourObjective: text.includes("Keep moving. Stay across the slope."),
    storyContinuingAction: actionClasses.some((action) => action.label === "Continue west"),
    detourAction: actionClasses.some((action) => action.label === "Go east"),
    noStoryEmphasis: actionClasses.every((action) => !String(action.className).includes("story")),
  };
  if (
    !found.objective ||
    !found.openingMapCaption ||
    !found.detourObjective ||
    !found.storyContinuingAction ||
    !found.detourAction ||
    !found.noStoryEmphasis
  ) {
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
