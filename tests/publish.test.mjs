import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { prepareStore } from "../scripts/prepare-store.mjs";
import {
  choosePullRequest,
  githubRepository,
  publishStore,
} from "../scripts/publish-store.mjs";

test("release flow creates or updates a PR, recovers after a push, and stops before publishing on failure", () => {
  const source = "a".repeat(40);
  const main = "b".repeat(40);
  for (const mode of [
    "new",
    "open",
    "retry",
    "dry",
    "failed",
    "dirty",
    "unchanged",
  ]) {
    const calls = [];
    let prepared;
    const execute = (command, args) => {
      calls.push([command, ...args]);
      if (command === "npm" && mode === "failed")
        throw new Error("Tests failed");
      if (command === "git") {
        if (args[0] === "status") return mode === "dirty" ? " M source" : "";
        if (args[0] === "branch") return "main";
        if (args[0] === "remote")
          return `https://github.com/msakowski/${args.at(-1) === "origin" ? "recast" : "extensions"}.git`;
        if (args[0] === "rev-parse") {
          if (args.at(-1) === "HEAD") return source;
          if (args.at(-1).endsWith("upstream")) return main;
          return args.at(-1).endsWith("submission") ? "submission" : "baseline";
        }
        if (args[0] === "ls-remote")
          return ["open", "retry"].includes(mode) ||
            args.at(-1).endsWith("source-snapshot")
            ? "remote ref"
            : "";
        if (args[0] === "diff")
          return args.includes("--name-only")
            ? "extensions/recast-text-rewriter/src/index.ts"
            : "1 file changed";
      }
      if (command === "gh") {
        if (args[0] === "api")
          return JSON.stringify({
            parent: { full_name: "raycast/extensions" },
          });
        if (args[0] === "pr" && args[1] === "list")
          return JSON.stringify(
            mode === "open"
              ? [
                  {
                    headRefName: "recast",
                    headRepository: { name: "extensions" },
                    headRepositoryOwner: { login: "msakowski" },
                    url: "https://github.com/raycast/extensions/pull/123",
                  },
                ]
              : [],
          );
        if (args[0] === "pr" && args[1] === "create") {
          assert.match(
            readFileSync(args[args.indexOf("--body-file") + 1], "utf8"),
            /Validation:/,
          );
          return "https://github.com/raycast/extensions/pull/124";
        }
      }
      return "";
    };
    const invoke = () =>
      publishStore(mode === "dry" ? ["--dry-run"] : [], {
        execute,
        prepare: (options) => {
          prepared = options;
          return {
            commit: "release",
            snapshot: "snapshot",
            changed: !["retry", "unchanged"].includes(mode),
          };
        },
        validate: () => calls.push(["validate-package"]),
      });
    if (["failed", "dirty"].includes(mode)) assert.throws(invoke);
    else invoke();
    const publishing = ["new", "open", "retry"].includes(mode);
    assert.equal(
      calls.some((call) => call[1] === "push"),
      publishing,
      mode,
    );
    assert.equal(
      calls.some((call) => call[1] === "pr" && call[2] === "create"),
      ["new", "retry"].includes(mode),
      mode,
    );
    assert.ok(!calls.flat().some((arg) => arg.includes("--force")));
    if (publishing) {
      assert.ok(calls.some((call) => call.includes("--atomic")));
      assert.ok(calls.some((call) => call[0] === "validate-package"));
      assert.equal(prepared.parent, mode === "new" ? main : "submission");
    }
  }
});

test("recognizes HTTPS and SSH fork URLs", () => {
  assert.equal(
    githubRepository("https://github.com/msakowski/extensions.git"),
    "msakowski/extensions",
  );
  assert.equal(
    githubRepository("git@github.com:msakowski/extensions.git"),
    "msakowski/extensions",
  );
  assert.throws(() => githubRepository("https://example.com/a/b"));
});

test("reuses legacy or new open PRs, ignores other forks, and rejects ambiguity", () => {
  const pr = (branch, fork = "msakowski/extensions") => ({
    head: { ref: branch, repo: { full_name: fork } },
  });
  const legacy = pr("recast");
  const update = pr("recast-text-rewriter-abc");
  assert.equal(choosePullRequest([legacy], "msakowski/extensions"), legacy);
  assert.equal(choosePullRequest([update], "msakowski/extensions"), update);
  assert.equal(
    choosePullRequest(
      [pr("recast", "other/extensions")],
      "msakowski/extensions",
    ),
    undefined,
  );
  assert.equal(choosePullRequest([], "msakowski/extensions"), undefined);
  assert.throws(
    () => choosePullRequest([legacy, update], "msakowski/extensions"),
    /Multiple/,
  );
});

test("packages source, preserves upstream edits across releases, and stops on conflicts", () => {
  const previousCwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "recast-publish-test-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const write = (path, value) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), value);
  };
  const commit = () => {
    git("add", ".");
    git("commit", "-qm", "Fixture");
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    const manifest = {
      name: "recast-text-rewriter",
      scripts: {
        build: "echo build",
        lint: "echo lint",
        test: "echo test",
        "test:publish": "echo test",
        "prepare:store": "echo prepare",
        "test:bundle": "echo bundle",
      },
      devDependencies: {},
    };
    write("source/package.json", JSON.stringify(manifest));
    write(
      "source/package-lock.json",
      JSON.stringify({
        name: manifest.name,
        lockfileVersion: 3,
        packages: { "": { name: manifest.name } },
      }),
    );
    write(
      "source/tsconfig.json",
      JSON.stringify({ include: ["src/**/*", "tests/**/*"] }),
    );
    for (const name of [
      ".gitignore",
      "CHANGELOG.md",
      "README.md",
      "eslint.config.mjs",
      "help.md",
      "assets/icon.png",
      "media/demo.png",
      "metadata/demo.png",
      "src/index.ts",
      "tests/local.ts",
      "DEVELOPMENT.md",
    ])
      write(`source/${name}`, "Original\n");
    write("extensions/unrelated/README.md", "Other extension\n");
    write(
      "source/CHANGELOG.md",
      "# Changelog\n\n## [Initial] - {PR_MERGE_DATE}\n\n- Initial release.\n",
    );
    const initial = commit();
    process.chdir(dir);
    const first = prepareStore({
      parent: initial,
      baseline: initial,
      sourceRef: git("rev-parse", "HEAD:source"),
    });
    const read = (ref, path) =>
      git("show", `${ref}:extensions/recast-text-rewriter/${path}`);
    const packaged = JSON.parse(read(first.commit, "package.json"));
    assert.equal(packaged.scripts.test, undefined);
    assert.equal(packaged.scripts["test:publish"], undefined);
    assert.equal(packaged.scripts.publish, "npx @raycast/api@latest publish");
    assert.deepEqual(JSON.parse(read(first.commit, "tsconfig.json")).include, [
      "src/**/*",
    ]);
    assert.equal(
      git("ls-tree", first.commit, "extensions/recast-text-rewriter/tests"),
      "",
    );
    assert.equal(git("status", "--porcelain"), "");
    // Source-only snapshot remains distinct from reviewer/contributor edits.
    git("reset", "--hard", first.commit);
    write("extensions/recast-text-rewriter/help.md", "Upstream help\n");
    write(
      "extensions/recast-text-rewriter/CHANGELOG.md",
      "# Changelog\n\n## [Initial] - 2026-11-16\n\n- Initial release.\n",
    );
    write("extensions/unrelated/README.md", "Updated other extension\n");
    const upstream = commit();
    write("source/src/index.ts", "Source fix\n");
    write(
      "source/CHANGELOG.md",
      "# Changelog\n\n## [Fix] - {PR_MERGE_DATE}\n\n- Selection fix.\n\n## [Initial] - 2026-11-16\n\n- Initial release.\n",
    );
    commit();
    const next = prepareStore({
      parent: upstream,
      baseline: first.snapshot,
      sourceRef: git("rev-parse", "HEAD:source"),
    });
    assert.equal(read(next.commit, "help.md"), "Upstream help");
    assert.equal(read(next.commit, "src/index.ts"), "Source fix");
    assert.equal(
      git("show", `${next.commit}:extensions/unrelated/README.md`),
      "Updated other extension",
    );
    const repeat = prepareStore({
      parent: next.commit,
      baseline: next.snapshot,
      sourceRef: git("rev-parse", "HEAD:source"),
    });
    assert.equal(repeat.changed, false);
    write("source/help.md", "Conflicting local help\n");
    commit();
    assert.throws(
      () =>
        prepareStore({
          parent: next.commit,
          baseline: next.snapshot,
          sourceRef: git("rev-parse", "HEAD:source"),
        }),
      /conflict/,
    );
    assert.equal(git("status", "--porcelain"), "");
  } finally {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
