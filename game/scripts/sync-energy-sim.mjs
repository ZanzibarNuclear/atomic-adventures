#!/usr/bin/env node
/**
 * Sync energy-sims host clients, fixtures, and WASM package into the game.
 *
 * Usage (from game/ or repo root with path):
 *   node scripts/sync-energy-sim.mjs
 *   node scripts/sync-energy-sim.mjs --skip-wasm
 *
 * Requires sibling checkout: ../../sims/energy-sims
 * WASM rebuild needs: rustup target wasm32-unknown-unknown, wasm-pack
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(__dirname, "..");
const repoRoot = resolve(gameRoot, "../..");
const energySims = resolve(repoRoot, "sims/energy-sims");
const destRoot = join(gameRoot, "src/lib/simulations/energySim");
const skipWasm = process.argv.includes("--skip-wasm");

if (!existsSync(energySims)) {
  console.error(`energy-sims not found at ${energySims}`);
  process.exit(1);
}

mkdirSync(join(destRoot, "fixtures"), { recursive: true });

const clientFiles = [
  "energySimBackend.js",
  "energySimPresent.js",
  "energySimClient.js",
];
for (const name of clientFiles) {
  const src = join(energySims, "clients/js", name);
  const dest = join(destRoot, name);
  copyFileSync(src, dest);
  console.log(`copied ${name}`);
}

const fixtures = [
  ["fixtures/stations/clearwater-station.json", "fixtures/clearwater-station.json"],
  ["fixtures/plants/clearwater-diversion.json", "fixtures/clearwater-diversion.json"],
  ["fixtures/plants/ideal-teaching.json", "fixtures/ideal-teaching.json"],
];
for (const [from, to] of fixtures) {
  copyFileSync(join(energySims, from), join(destRoot, to));
  console.log(`copied ${to}`);
}

if (!skipWasm) {
  for (const [target, dirName] of [
    ["web", "pkg"],
    ["nodejs", "pkg-node"],
  ]) {
    const pkgDir = join(destRoot, dirName);
    if (existsSync(pkgDir)) {
      rmSync(pkgDir, { recursive: true, force: true });
    }
    const result = spawnSync(
      "wasm-pack",
      [
        "build",
        "crates/energy-sim-wasm",
        "--target",
        target,
        "--out-dir",
        pkgDir,
      ],
      { cwd: energySims, stdio: "inherit" },
    );
    if (result.status !== 0) {
      console.error(`wasm-pack (${target}) failed`);
      process.exit(result.status ?? 1);
    }
    // wasm-pack writes pkg/.gitignore with "*"; allow committing prebuilt artifacts
    const gi = join(pkgDir, ".gitignore");
    if (existsSync(gi)) {
      rmSync(gi);
    }
    writeFileSync(
      join(pkgDir, "README.md"),
      [
        `# energy-sim-wasm (${target})`,
        "",
        target === "web"
          ? "Browser / Vite game runtime."
          : "Node / Vitest smoke tests.",
        "",
        "Rebuild:",
        "",
        "```sh",
        "npm run sync:energy-sim -w game",
        "```",
        "",
      ].join("\n"),
    );
    console.log(`WASM package built into src/lib/simulations/energySim/${dirName}`);
  }
} else {
  console.log("skipped WASM rebuild");
}

console.log("energy-sims sync complete");
