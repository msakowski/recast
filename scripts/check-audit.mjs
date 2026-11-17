import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const advisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const expires = Date.parse("2026-12-17T00:00:00Z");

// Temporary, reviewed tooling-only exception; see DEVELOPMENT.md. Follow
// npm's dependency links so this never hides a second advisory on a parent.
export function evaluateAudit(report, lock, now = Date.now()) {
  if (
    report.error ||
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    !report.metadata?.vulnerabilities
  )
    throw new Error("Invalid or failed npm audit response");
  const vulnerabilities = report.vulnerabilities;
  function excepted(name, visited = new Set()) {
    const item = vulnerabilities[name];
    if (now >= expires || visited.has(name) || !item?.via?.length) return false;
    const seen = new Set([...visited, name]);
    return item.via.every((via) => {
      if (typeof via === "string") return excepted(via, seen);
      return (
        name === "picomatch" &&
        via.name === "picomatch" &&
        via.url === advisory &&
        item.nodes?.length === 1 &&
        item.nodes[0] === "node_modules/picomatch" &&
        lock.packages?.["node_modules/picomatch"]?.version === "4.0.7"
      );
    });
  }
  const accepted = [],
    blocked = [];
  for (const name of Object.keys(vulnerabilities))
    (excepted(name) ? accepted : blocked).push(name);
  if (
    !Object.keys(vulnerabilities).length &&
    report.metadata.vulnerabilities.total !== 0
  )
    throw new Error("Inconsistent npm audit response");
  return { accepted, blocked };
}

export function checkAudit() {
  const result = spawnSync(
    "npm",
    ["audit", "--json", "--fetch-retries=0", "--fetch-timeout=30000"],
    {
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.error || ![0, 1].includes(result.status))
    throw new Error(
      `npm audit failed: ${result.error?.message || result.stderr}`,
    );
  const { accepted, blocked } = evaluateAudit(
    JSON.parse(result.stdout),
    JSON.parse(readFileSync("package-lock.json", "utf8")),
  );
  if (accepted.length)
    console.warn(
      `Temporary exception through 2026-12-16: ${advisory} (picomatch 4.0.7, Raycast build/lint tooling; ${accepted.length} affected dependency entries). No upstream patch exists. See DEVELOPMENT.md.`,
    );
  if (blocked.length)
    throw new Error(
      `Unexcepted audit findings: ${blocked.join(", ")}. Run npm audit for details.`,
    );
  console.log("Dependency audit policy passed.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    checkAudit();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
