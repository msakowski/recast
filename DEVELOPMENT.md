# Developing Recast

Requires macOS, [Raycast](https://www.raycast.com/), Node.js 26.12.1 or later (matching the current Raycast runtime), and npm.

```sh
git clone https://github.com/msakowski/recast.git
cd recast
npm ci
npm run dev
```

```sh
npm run check      # types, behavioral tests, Raycast lint, production build, bundle smoke test
npm audit         # dependency advisory check
```

The bundle smoke test loads all three generated commands and exercises the packaged AWS SDK through request serialization, without network access or real credentials. Tests cover stream failures, truncation, cancellation, routing, parameter validation, Unicode, and literal previews. The `minimatch` override pins the patched tooling dependency until upstream consumers update their ranges.

Store publication requires Raycast’s review and merge of the generated pull request. Development changes can be submitted to [the source repository](https://github.com/msakowski/recast).

## Publishing and updating the Store

Develop here and use `npm run dev` to test in Raycast. Store releases follow Raycast's [fork-and-pull-request workflow](https://developers.raycast.com/basics/publish-an-extension). Review and merge by Raycast are still required; merging publishes the extension and installed Store copies update automatically.

One-time prerequisites:

- A recent Git supporting `git merge-tree --write-tree --merge-base`, npm, and the GitHub CLI (`gh`).
- Authenticate with `gh auth login` and configure Git access with `gh auth setup-git` if needed.
- `origin` must point to `msakowski/recast`; `raycast-store` must point to your fork of `raycast/extensions` (currently `msakowski/extensions`).
- Keep the legacy `recast` submission branch available for the first run. Subsequent runs store their packaging baseline in the fork's `recast-source-snapshot` branch; do not delete that branch.

For each release, test the change in Raycast, add a `CHANGELOG.md` entry with `{PR_MERGE_DATE}`, merge the source changes into `main`, and commit everything. Then run:

```sh
npm run publish -- --dry-run  # validate and inspect without pushing or creating a PR
npm run publish              # validate, push source and Store branches, create/update PR
```

`npm run prepare:store` is an alias for the dry run. A dry run needs network access and authentication: it fetches current repository state, runs checks, and creates local Git objects/refs, but does not change your checked-out branch, working files, remote branches, or PRs. It prints a `git diff` command to inspect the exact proposed Store changes.

The publishing command:

1. Requires clean, committed source on `main`, an authenticated GitHub CLI, and the correct remotes.
2. Finds an open Recast Store PR, including the original `recast` submission. With no open PR, starts a fresh update from the latest upstream `main`.
3. Runs the complete source checks, packages only Store files, and merges the source changes with the current Store content. Nonconflicting upstream contributions survive; conflicts stop the release for reconciliation in this repo.
4. Installs the packaged dependencies in a temporary directory and validates the actual Store artifact with build and lint.
5. Pushes source `main` to `origin`, then atomically pushes the Store submission and source snapshot to the fork, using fast-forward pushes only.
6. Updates the existing PR by pushing commits, or opens a new PR with the latest changelog entry and validation details, then prints its URL. Existing reviewer-edited PR descriptions are preserved.

If a push or PR request fails, fix the reported issue and rerun the command. Deterministic branch names allow recovery after a successful push followed by failed PR creation. Multiple open Recast PRs or concurrent branch changes stop publication rather than overwrite work. Source and Store pushes are separate transactions; a failed Store push can leave source `main` successfully updated. No automatic merge is attempted.

The Store snapshot omits tests, contributor docs, generated declarations, CI, and local publishing scripts. `npm run test:publish` exercises packaging, repeat releases, contribution preservation, and merge conflicts using temporary Git repositories. Keep the remote snapshot branch even after a Store PR merges so fresh clones retain the merge baseline.

## Checking selection capture

Select text B in an external app while the clipboard contains different text A, then launch each rewrite command. The original text must be B on the first launch. Repeat using both a hotkey and Raycast search, then select text C and relaunch. Also check text already matching the clipboard (up to 600 ms of verification), empty selections, and unsupported apps (manual entry).

The selection guard compares Raycast's selection result with a pre-capture clipboard snapshot and retries ambiguous matches. It never supplies clipboard text as a fallback or writes to the clipboard. Automated tests simulate delayed native selection reads; testing in the affected app is still necessary because Raycast owns the native selection implementation.

When updating Store screenshots, open the command in Raycast, move the pointer off the window, and use Window Capture → Save to Metadata. Keep at least two screenshots. Review `metadata/recast-2.png` and `metadata/recast-3.png` for visible pointers before resubmitting.

Run `npm run build` before a standalone `npm run typecheck` on a fresh checkout. The build generates preference and argument declarations from the manifest; `npm run check` already runs in this order. Never edit or commit `raycast-env.d.ts`.
