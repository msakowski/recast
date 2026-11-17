import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAudit } from "../scripts/check-audit.mjs";

const now = Date.parse("2026-11-17T00:00:00Z");
const lock = { packages: { "node_modules/picomatch": { version: "4.0.7" } } };
function report() {
  return {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { total: 2 } },
    vulnerabilities: {
      picomatch: {
        nodes: ["node_modules/picomatch"],
        via: [
          {
            name: "picomatch",
            url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
          },
        ],
      },
      tinyglobby: { via: ["picomatch"] },
    },
  };
}
test("accepts only the reviewed advisory and its transitive effects", () => {
  assert.deepEqual(evaluateAudit(report(), lock, now).blocked, []);
  const mixed = report();
  mixed.vulnerabilities.picomatch.via.push({
    name: "picomatch",
    url: "https://github.com/advisories/another",
  });
  assert.deepEqual(evaluateAudit(mixed, lock, now).blocked, [
    "picomatch",
    "tinyglobby",
  ]);
});
test("expires and requires the reviewed version and installation path", () => {
  assert.equal(
    evaluateAudit(report(), lock, Date.parse("2026-12-17")).blocked.length,
    2,
  );
  assert.equal(
    evaluateAudit(report(), { packages: {} }, now).blocked.length,
    2,
  );
  const nested = report();
  nested.vulnerabilities.picomatch.nodes.push(
    "node_modules/other/node_modules/picomatch",
  );
  assert.equal(evaluateAudit(nested, lock, now).blocked.length, 2);
});
test("fails closed on registry errors, malformed responses, and broken dependency links", () => {
  for (const invalid of [
    { error: "Network" },
    {},
    { ...report(), auditReportVersion: 3 },
  ])
    assert.throws(() => evaluateAudit(invalid, lock, now));
  const broken = report();
  broken.vulnerabilities.tinyglobby.via = ["missing"];
  assert.deepEqual(evaluateAudit(broken, lock, now).blocked, ["tinyglobby"]);
  broken.vulnerabilities.tinyglobby.via = ["tinyglobby"];
  assert.deepEqual(evaluateAudit(broken, lock, now).blocked, ["tinyglobby"]);
});
