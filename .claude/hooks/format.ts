// PostToolUse hook: format + lint-fix the file Claude just edited. Never fails the tool call.
import { join, relative, sep } from "node:path";

const root = join(import.meta.dir, "..", "..");
const input = await Bun.stdin.json().catch(() => null);
const file: unknown = input?.tool_input?.file_path;

if (typeof file === "string") {
  // Relative, forward-slash path: Windows backslashes get mangled on the way to Biome.
  const target = relative(root, file).split(sep).join("/");
  if (!target.startsWith("..")) {
    const biome = join(
      root,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "biome.exe" : "biome",
    );
    Bun.spawnSync(
      [
        biome,
        "check",
        "--write",
        "--no-errors-on-unmatched",
        "--files-ignore-unknown=true",
        target,
      ],
      { cwd: root, stdout: "ignore", stderr: "ignore" },
    );
  }
}
