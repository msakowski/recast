// Source-repository publishing helper. It creates the store commit in this
// repository without checking out Raycast's monorepo or changing working files.
import { execFileSync } from "node:child_process";

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
if (manifest.name !== "recast")
  throw new Error("Run this helper from the Recast source repository.");
manifest.scripts.publish = "npx @raycast/api@latest publish";
manifest.scripts.check = "npm run build && npm test && npm run lint";
delete manifest.scripts["prepare:store"];
delete manifest.scripts["test:bundle"];
const manifestBlob = git(
  ["hash-object", "-w", "--stdin"],
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// Keep user-facing material and lightweight tests. The monorepo owns licensing;
// contributor docs, local tooling, and generated declarations stay in source.
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
  "tests",
  "tsconfig.json",
]);
const source = entries("HEAD").filter((entry) => allowed.has(name(entry)));
if (source.length !== allowed.size)
  throw new Error("The source package is incomplete.");
const extension = makeTree(
  source.map((entry) =>
    name(entry) === "package.json"
      ? `100644 blob ${manifestBlob}\tpackage.json`
      : entry,
  ),
);
const root = entries(parent);
const oldExtensions = root.find((entry) => name(entry) === "extensions");
if (!oldExtensions)
  throw new Error(
    "The store branch does not have Raycast's repository structure.",
  );
const extensionsHash = oldExtensions.split("\t")[0].split(" ")[2];
const extensions = entries(extensionsHash);
const previous = extensions.find((entry) => name(entry) === "recast");
if (previous?.split("\t")[0].split(" ")[2] === extension) {
  console.log("The store branch already matches the committed source.");
  process.exit(0);
}
const updatedExtensions = makeTree([
  ...extensions.filter((entry) => name(entry) !== "recast"),
  `040000 tree ${extension}\trecast`,
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
git(["diff", "--check", parent, commit, "--", "extensions/recast/"]);
git(["update-ref", "refs/heads/recast", commit, parent]);
console.log(
  `Prepared store commit ${commit}. Push with: git push raycast-store recast`,
);
