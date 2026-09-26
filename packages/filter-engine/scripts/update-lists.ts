// Refreshes the committed filter-list snapshots. Run: bun run lists:update, then commit lists/.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LISTS } from "./lists";

for (const list of LISTS) {
  const response = await fetch(list.url);
  if (!response.ok) throw new Error(`${list.url}: HTTP ${response.status}`);
  const text = await response.text();
  if (!text.startsWith("[Adblock Plus")) throw new Error(`${list.url}: not a filter list`);
  await writeFile(join(import.meta.dir, "..", "lists", `${list.id}.txt`), text);
  const version = /^! Version: (.+)$/m.exec(text)?.[1] ?? "unknown";
  console.log(`${list.id}: version ${version}, ${text.length} bytes`);
}
