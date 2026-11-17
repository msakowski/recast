import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareStore } from "./prepare-store.mjs";

const upstream = "raycast/extensions";
const remote = "raycast-store";
const extension = "recast-text-rewriter";
const snapshotRef = "refs/recast-store/source-snapshot";
const snapshotBranch = "recast-source-snapshot";
const run = (command, args, options = {}) =>
  (execFileSync(command, args, { encoding: "utf8", ...options }) ?? "").trim();

export function githubRepository(url) {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(
      url,
    );
  if (!match)
    throw new Error(
      "raycast-store must point to a GitHub fork using HTTPS or SSH.",
    );
  return match[1];
}

export function choosePullRequest(prs, fork) {
  const matches = prs.filter(
    (pr) =>
      pr.head.repo?.full_name === fork &&
      (pr.head.ref === "recast" || pr.head.ref.startsWith(`${extension}-`)),
  );
  if (matches.length > 1)
    throw new Error(
      "Multiple open Recast Store PRs found. Close or reconcile them first.",
    );
  return matches[0];
}

function validatePackage(commit) {
  const dir = mkdtempSync(join(tmpdir(), "recast-store-check-"));
  try {
    const archive = execFileSync(
      "git",
      ["archive", `${commit}:extensions/${extension}`],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    execFileSync("tar", ["-xf", "-", "-C", dir], { input: archive });
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: dir,
      stdio: "inherit",
    });
    run("npm", ["run", "check"], { cwd: dir, stdio: "inherit" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function publishStore(
  args = process.argv.slice(2),
  { execute = run, prepare = prepareStore, validate = validatePackage } = {},
) {
  const run = execute;
  const git = (...args) => run("git", args);
  const gh = (...args) => run("gh", args);
  const exists = (ref) => {
    try {
      return git("rev-parse", "--verify", ref);
    } catch {
      return undefined;
    }
  };
  const fetchBranch = (url, branch, ref) => {
    console.log(`Fetching ${branch} from ${url}…`);
    run(
      "git",
      [
        "fetch",
        "--no-tags",
        "--progress",
        "--filter=blob:none",
        url,
        `+refs/heads/${branch}:${ref}`,
      ],
      {
        stdio: ["ignore", "pipe", "inherit"],
        timeout: 180000,
      },
    );
    return git("rev-parse", ref);
  };

  if (args.some((arg) => arg !== "--dry-run"))
    throw new Error("Usage: npm run publish -- [--dry-run]");
  const dryRun = args.includes("--dry-run");
  if (git("status", "--porcelain"))
    throw new Error(
      "Commit the source changes before publishing (including the changelog).",
    );
  const source = git("rev-parse", "HEAD");
  if (git("branch", "--show-current") !== "main")
    throw new Error("Publish from main after merging the release changes.");
  if (
    githubRepository(git("remote", "get-url", "--push", "origin")) !==
    "msakowski/recast"
  )
    throw new Error("origin must point to msakowski/recast.");
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  const entry = changelog.split(/^## /m)[1]?.trim();
  if (!entry || !entry.split("\n")[0].includes("{PR_MERGE_DATE}"))
    throw new Error(
      "Add a changelog entry dated {PR_MERGE_DATE} before publishing.",
    );
  const fork = githubRepository(git("remote", "get-url", "--push", remote));
  const owner = fork.split("/")[0];
  gh("auth", "status", "--hostname", "github.com");
  const repository = JSON.parse(gh("api", `repos/${fork}`));
  if (repository.parent?.full_name !== upstream)
    throw new Error(`${fork} is not a fork of ${upstream}.`);
  const prs = JSON.parse(
    gh(
      "pr",
      "list",
      "--repo",
      upstream,
      "--state",
      "open",
      "--base",
      "main",
      "--search",
      "head:recast",
      "--limit",
      "1000",
      "--json",
      "headRefName,headRepository,headRepositoryOwner,url",
    ),
  );
  if (prs.length === 1000)
    throw new Error("Too many matching PRs to safely select a submission.");
  const pr = choosePullRequest(
    prs.map((item) => ({
      head: {
        ref: item.headRefName,
        repo: {
          full_name: `${item.headRepositoryOwner?.login}/${item.headRepository?.name}`,
        },
      },
      html_url: item.url,
    })),
    fork,
  );
  const main = fetchBranch(
    `https://github.com/${upstream}.git`,
    "main",
    "refs/recast-store/upstream",
  );
  const branch =
    pr?.head.ref ?? `${extension}-${source.slice(0, 12)}-${main.slice(0, 8)}`;
  // A deterministic branch makes retrying a failed PR creation safe.
  const remoteBranch = git(
    "ls-remote",
    "--heads",
    remote,
    `refs/heads/${branch}`,
  );
  const parent = remoteBranch
    ? fetchBranch(remote, branch, "refs/recast-store/submission")
    : main;
  if (pr && !remoteBranch)
    throw new Error("The open PR's branch is missing from the fork.");

  // The initial submission is the migration baseline for this source repo.
  // Later successful publications keep an exact source snapshot, separate
  // from the merged Store tree so upstream-only edits survive future releases.
  const storedSnapshot = git(
    "ls-remote",
    "--heads",
    remote,
    `refs/heads/${snapshotBranch}`,
  );
  const baseline = storedSnapshot
    ? fetchBranch(remote, snapshotBranch, snapshotRef)
    : (exists("refs/heads/recast") ??
      fetchBranch(remote, "recast", "refs/recast-store/bootstrap"));

  console.log(
    `Validating source ${source.slice(0, 12)} for ${pr ? pr.html_url : "a new Store PR"}…`,
  );
  run("npm", ["run", "check"], { stdio: "inherit" });
  if (git("status", "--porcelain") || git("rev-parse", "HEAD") !== source)
    throw new Error("Source changed during validation. Commit and retry.");
  const prepared = prepare({ parent, baseline, sourceRef: source });
  const paths = git("diff", "--name-only", parent, prepared.commit)
    .split("\n")
    .filter(Boolean);
  if (
    paths.some(
      (path) =>
        !path.startsWith(`extensions/${extension}/`) &&
        !path.startsWith("extensions/recast/"),
    )
  )
    throw new Error(
      "Refusing to publish changes outside the Recast extension.",
    );
  console.log(
    git("diff", "--stat", parent, prepared.commit) ||
      "Store content already matches.",
  );
  if (prepared.changed || (!pr && parent !== main)) validate(prepared.commit);
  if (dryRun) {
    console.log(
      `Dry run: no push or PR changes. Inspect with git diff ${parent} ${prepared.commit}`,
    );
    return;
  }
  if (!prepared.changed && !pr && parent === main) {
    console.log("No Store update needed.");
    return;
  }
  // Normal fast-forward push only. Concurrent updates fail without overwriting.
  if (git("status", "--porcelain") || git("rev-parse", "HEAD") !== source)
    throw new Error("Source changed during packaging. Commit and retry.");
  git("push", "origin", `${source}:refs/heads/main`);
  git(
    "push",
    "--atomic",
    remote,
    `${prepared.changed ? prepared.commit : parent}:refs/heads/${branch}`,
    `${prepared.snapshot}:refs/heads/${snapshotBranch}`,
  );
  if (pr) {
    console.log(`Updated Store PR: ${pr.html_url}`);
    return;
  }
  const staging = mkdtempSync(join(tmpdir(), "recast-publish-"));
  try {
    const body = join(staging, "pr.md");
    writeFileSync(
      body,
      `## ${entry}\n\nValidation: \`npm run check\` passed (build, tests, lint, bundle smoke test). The packaged Store extension also passed build and lint.\n\nSource: https://github.com/msakowski/recast/commit/${source}\n`,
    );
    const url = gh(
      "pr",
      "create",
      "--repo",
      upstream,
      "--base",
      "main",
      "--head",
      `${owner}:${branch}`,
      "--title",
      "Update Recast - Text Rewriter",
      "--body-file",
      body,
    );
    console.log(`Created Store PR: ${url}`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    publishStore();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
