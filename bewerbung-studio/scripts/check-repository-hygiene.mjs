import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repository = path.resolve(import.meta.dirname, "../..");
const listing = spawnSync("git", ["ls-files", "-z"], { cwd: repository, encoding: "utf8" });
if (listing.status !== 0) throw new Error("Could not inspect tracked files.");

const forbiddenPath = /(?:^|\/)(?:tmp|temp|Crashpad|GPUCache|ShaderCache|Default)(?:\/|$)|(?:^|\/)Local State$|(?:^|\/)\.env(?:\.|$)|\.(?:pfx|p12|pem|key)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const failures = [];
for (const relative of listing.stdout.split("\0").filter(Boolean)) {
  const normalized = relative.replaceAll("\\", "/");
  if (forbiddenPath.test(normalized)) {
    failures.push(`${normalized}: runtime or secret file is tracked`);
    continue;
  }
  const file = path.join(repository, relative);
  if (!existsSync(file)) continue;
  const info = statSync(file);
  if (!info.isFile() || info.size > 1024 * 1024) continue;
  const content = readFileSync(file);
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  if (secretPatterns.some((pattern) => pattern.test(text)))
    failures.push(`${normalized}: possible secret`);
}
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Tracked runtime artifacts and common secret patterns: clear.\n");
}
