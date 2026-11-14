// Source-repository publishing helper. It creates the store commit in this
// repository without checking out Raycast's monorepo or changing working files.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = { ...process.env, GIT_NO_LAZY_FETCH: "1" };
const git = (args, input) =>
  execFileSync("git", args, { env, input, encoding: "utf8" }).trim();
const entries = (ref) =>
  git(["ls-tree", "-z", ref]).split("\0").filter(Boolean);
const name = (entry) => entry.split("\t")[1];
const makeTree = (items) =>
  git(["mktree", "--missing", "-z"], `${items.join("\0")}\0`);

if (git(["status", "--porcelain"]))
  throw new Error(
    "Commit the source changes before preparing the store branch.",
  );
const parent = git(["rev-parse", "refs/heads/recast"]);
if (parent !== git(["rev-parse", "refs/remotes/raycast-store/recast"])) {
  throw new Error(
    "The local and fetched store branches differ. Reconcile them before preparing another submission.",
  );
}
const manifest = JSON.parse(git(["show", "HEAD:package.json"]));
if (manifest.name !== "recast-text-rewriter")
  throw new Error("Run this helper from the Recast source repository.");
manifest.scripts.publish = "npx @raycast/api@latest publish";
manifest.scripts.check = "npm run build && npm run lint";
delete manifest.scripts.test;
delete manifest.scripts["prepare:store"];
delete manifest.scripts["test:bundle"];
for (const dependency of [
  "tsx",
  "react-test-renderer",
  "@types/react-test-renderer",
])
  delete manifest.devDependencies[dependency];
const manifestBlob = git(
  ["hash-object", "-w", "--stdin"],
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// Let npm prune the test-only dependency graph, preserving locked versions.
const staging = mkdtempSync(join(tmpdir(), "recast-store-"));
let lockBlob;
try {
  writeFileSync(join(staging, "package.json"), JSON.stringify(manifest));
  writeFileSync(
    join(staging, "package-lock.json"),
    git(["show", "HEAD:package-lock.json"]),
  );
  execFileSync(
    "npm",
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: staging,
      stdio: "inherit",
    },
  );
  lockBlob = git(
    ["hash-object", "-w", "--stdin"],
    readFileSync(join(staging, "package-lock.json")),
  );
} finally {
  rmSync(staging, { recursive: true, force: true });
}
const tsconfig = JSON.parse(git(["show", "HEAD:tsconfig.json"]));
tsconfig.include = tsconfig.include.filter(
  (path) => !path.startsWith("tests/"),
);
const tsconfigBlob = git(
  ["hash-object", "-w", "--stdin"],
  `${JSON.stringify(tsconfig, null, 2)}\n`,
);

// The monorepo owns licensing. Tests, contributor docs, local tooling, and
// generated declarations stay in source; Store users receive the extension.
const allowed = new Set([
  ".gitignore",
  "CHANGELOG.md",
  "README.md",
  "assets",
  "eslint.config.mjs",
  "help.md",
  "media",
  "metadata",
  "package-lock.json",
  "package.json",
  "src",
  "tsconfig.json",
]);
const source = entries("HEAD").filter((entry) => allowed.has(name(entry)));
if (source.length !== allowed.size)
  throw new Error("The source package is incomplete.");
const replacements = {
  "package.json": manifestBlob,
  "package-lock.json": lockBlob,
  "tsconfig.json": tsconfigBlob,
};
const extension = makeTree(
  source.map((entry) => {
    const file = name(entry);
    return replacements[file]
      ? `100644 blob ${replacements[file]}\t${file}`
      : entry;
  }),
);
const root = entries(parent);
const oldExtensions = root.find((entry) => name(entry) === "extensions");
if (!oldExtensions)
  throw new Error(
    "The store branch does not have Raycast's repository structure.",
  );
const extensionsHash = oldExtensions.split("\t")[0].split(" ")[2];
const extensions = entries(extensionsHash);
const previous = extensions.find((entry) => name(entry) === manifest.name);
if (
  !extensions.some((entry) => name(entry) === "recast") &&
  previous?.split("\t")[0].split(" ")[2] === extension
) {
  console.log("The store branch already matches the committed source.");
  process.exit(0);
}
const updatedExtensions = makeTree([
  ...extensions.filter(
    (entry) => !["recast", manifest.name].includes(name(entry)),
  ),
  `040000 tree ${extension}\t${manifest.name}`,
]);
const updatedRoot = makeTree([
  ...root.filter((entry) => name(entry) !== "extensions"),
  `040000 tree ${updatedExtensions}\textensions`,
]);
const commit = git([
  "commit-tree",
  updatedRoot,
  "-p",
  parent,
  "-m",
  "Address Recast store review feedback",
]);
git([
  "diff",
  "--check",
  parent,
  commit,
  "--",
  "extensions/recast/",
  `extensions/${manifest.name}/`,
]);
git(["update-ref", "refs/heads/recast", commit, parent]);
console.log(
  `Prepared store commit ${commit}. Push with: git push raycast-store recast`,
);
