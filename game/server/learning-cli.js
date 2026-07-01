import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { openDatabase } from "./db.js";
import { createContentRepositories } from "./content-repositories.js";

const [command, ...args] = process.argv.slice(2);
const positional = args.filter((item) => !item.startsWith("--"));
const db = openDatabase();

try {
  const { learningRepository: repository } = createContentRepositories(db);
  if (command === "import") {
    const file = positional[0];
    if (!file) throw new Error("Usage: npm run learning:import -- <learning.yaml>");
    const candidate = yaml.load(readFileSync(resolve(file), "utf8"));
    const existing = repository.getDocument();
    const result = repository.save(candidate, existing.version);
    console.log(`Imported learning content version ${result.version}.`);
  } else if (command === "export") {
    const output = resolve(positional[0] ?? "/tmp/learning-main.learning.yaml");
    const existing = repository.getDocument();
    if (!existing) throw new Error("Learning content is not initialized.");
    writeFileSync(output, yaml.dump(existing.learning, { lineWidth: 100 }));
    console.log(`Exported learning content to ${output}.`);
  } else {
    throw new Error(
      "Usage: learning-cli.js import <learning.yaml> | export [output]",
    );
  }
} finally {
  db.close();
}
