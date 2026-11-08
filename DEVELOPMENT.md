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

## Updating the store submission

Keep all work in this source repository. The `origin` remote is `msakowski/recast`; `raycast-store` points to your fork of `raycast/extensions`.

After committing and validating changes on `main`:

```sh
git push origin main
git fetch raycast-store recast
npm run publish
```

`prepare:store` creates a commit on the local `recast` branch using the committed source. It preserves the rest of the monorepo and leaves your checked-out branch and working files unchanged. The store snapshot omits this guide, the standalone license, Node version file, generated declarations, CI, and source-only publishing/bundle scripts. It retains the lightweight tests and their dependencies. Publication still requires Raycast’s review and merge of the store PR.

Run `npm run build` before a standalone `npm run typecheck` on a fresh checkout. The build generates preference and argument declarations from the manifest; `npm run check` already runs in this order. Never edit or commit `raycast-env.d.ts`.
