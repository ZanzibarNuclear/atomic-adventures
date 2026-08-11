/**
 * Alpha Story mode smoke playtest (Playwright).
 * Proves a new game can choose Story mode and reach the opener map/scene.
 * Extend later toward gate / sleep / hydro checkpoints.
 *
 * Usage (from repo root, with dev server on :5173):
 *   node game/scripts/alpha-play-smoke.mjs
 *   BASE_URL=http://127.0.0.1:5173 node game/scripts/alpha-play-smoke.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PLAYTEST_OUT || join(__dirname, "../tmp/playtest-artifacts");
mkdirSync(OUT, { recursive: true });

const findings = [];
function ok(id, detail) {
  findings.push({ id, status: "pass", detail });
  console.log(`PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  findings.push({ id, status: "fail", detail });
  console.error(`FAIL  ${id}: ${detail}`);
}
function note(id, detail) {
  findings.push({ id, status: "note", detail });
  console.log(`NOTE  ${id}: ${detail}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Fresh game: clear storage so mode chooser appears
await context.clearCookies();
const page = await context.newPage();
await page.addInitScript(() => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

page.on("pageerror", (err) => note("pageerror", String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") note("console-error", msg.text());
});

try {
  // Vite HMR / SSE keep the network busy, so never wait for networkidle.
  const resp = await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!resp || !resp.ok()) {
    fail("load", `HTTP ${resp?.status()} loading ${BASE_URL}`);
  } else {
    ok("load", `${BASE_URL} status ${resp.status()}`);
  }

  // Wait for title screen (or restored play / error)
  const enterBtn = page.getByRole("button", { name: /^Welcome$/i });
  const titleHeading = page.getByRole("heading", { name: /Zanzibar's World of Energy/i });
  const appRoot = page.locator("#app");
  await appRoot.waitFor({ state: "attached", timeout: 30000 });
  await enterBtn.or(page.getByRole("button", { name: /New Game/i })).or(page.getByText(/Retry|error/i)).first()
    .waitFor({ state: "visible", timeout: 30000 })
    .catch(() => {});
  await shot(page, "01-loaded");

  const hasTitle = await enterBtn.isVisible().catch(() => false);
  if (!hasTitle) {
    // Maybe a save restored playMode — force new game if UI offers it
    const newGame = page.getByRole("button", { name: /New Game/i }).first();
    if (await newGame.isVisible().catch(() => false)) {
      await newGame.click();
      await page.waitForTimeout(500);
    }
  }

  const titleVisible = await enterBtn.isVisible().catch(() => false);
  if (!titleVisible) {
    fail("title-screen", "Title screen not visible after load/clear. Check existing save UI.");
    await shot(page, "02-no-title-screen");
  } else {
    ok("title-screen", "Title screen with Welcome is visible");
    await shot(page, "02-title-screen");

    await enterBtn.click();
    ok("enter-game", "Clicked Welcome");
    await page.waitForTimeout(2000);
    await shot(page, "03-after-enter");

    // Title screen should go away
    const stillTitle = await enterBtn.isVisible().catch(() => false);
    if (stillTitle) fail("story-started", "Title screen still visible after Welcome");
    else ok("story-started", "Title screen dismissed; story mode started");

    // Look for opener prose or map chrome
    const bodyText = await page.locator("body").innerText();
    const hints = [
      /Lost in the woods/i,
      /Keep walking/i,
      /Zanzibar/i,
      /woods/i,
      /provisions/i,
    ];
    const hit = hints.find((re) => re.test(bodyText));
    if (hit) ok("opener-prose", `Found text matching ${hit}`);
    else note("opener-prose", "No strong opener phrase match; dumping text sample for review");

    // Developer menu only in DEV — not required
    const header = page.locator("header, .app-header, [class*='header']").first();
    if (await header.isVisible().catch(() => false)) ok("chrome", "Header/chrome present");
    else note("chrome", "No obvious header locator");

    // Try first obvious story choice if present
    const keepWalking = page.getByRole("button", { name: /Keep walking/i }).first();
    if (await keepWalking.isVisible().catch(() => false)) {
      await keepWalking.click();
      await page.waitForTimeout(1500);
      await shot(page, "04-after-first-choice");
      ok("first-choice", "Clicked Keep walking (or similar)");
    } else {
      // Story choices may be in a panel as buttons with different labels
      const choiceButtons = page.locator(".story-overlay button, .story-panel button, [class*='story'] button");
      const count = await choiceButtons.count();
      note("first-choice", `No Keep walking; found ${count} story-ish buttons`);
      if (count > 0) {
        const label = (await choiceButtons.first().innerText()).trim().slice(0, 80);
        await choiceButtons.first().click();
        await page.waitForTimeout(1500);
        await shot(page, "04-after-first-choice");
        ok("first-choice-fallback", `Clicked first story button: ${label}`);
      }
    }

    // Sample body text for manual review
    writeFileSync(join(OUT, "body-sample.txt"), bodyText.slice(0, 4000), "utf8");
  }
} catch (err) {
  fail("exception", String(err?.stack || err));
  try {
    await shot(page, "99-exception");
  } catch {
    /* ignore */
  }
} finally {
  writeFileSync(join(OUT, "findings.json"), JSON.stringify(findings, null, 2), "utf8");
  await browser.close();
}

const failed = findings.filter((f) => f.status === "fail");
console.log(`\nArtifacts: ${OUT}`);
console.log(`Summary: ${findings.filter((f) => f.status === "pass").length} pass, ${failed.length} fail, ${findings.filter((f) => f.status === "note").length} notes`);
process.exit(failed.length ? 1 : 0);
