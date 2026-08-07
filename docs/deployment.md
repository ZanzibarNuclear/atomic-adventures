# Deployment

Atomic Adventures is deployed to Vercel through its GitHub integration. Vercel
builds the playable `game/` app whenever the configured production branch or a
preview branch is pushed.

## Production Architecture

Production is intentionally read-only:

```text
Committed SQLite content
  → build-time runtime export
  → static story.json + world.json + utility-station.json + character.json
  → Vite production bundle
  → Vercel CDN
```

The tracked `game/content/atomic-adventures.sqlite` database remains canonical
for story and outdoor-world authoring. During every production build,
`game/server/export-runtime-content.js` reads that database and generates:

- `/content/story.json`
- `/content/world.json`
- `/content/utility-station.json`
- `/content/character.json`

These files are copied into `game/dist` by Vite. The production game reads them
instead of calling the local authoring API.

The production deployment does **not** run `game/server/index.js`, open SQLite
for writes, expose the content API, or connect to the SSE stream. Story Builder
and World Builder are excluded from the production bundle and `/builder/*`
redirects to the game.

This avoids relying on Vercel Functions for persistent filesystem writes or
long-lived in-memory connections.

## Repository Configuration

Deployment behavior is checked into the repository:

| File | Purpose |
| --- | --- |
| `vercel.json` | Build command, output directory, SPA fallback, and cache headers |
| `.nvmrc` | Local Node.js baseline: 24 (matches Vercel) |
| `package.json` | Declares Node `>=24` (Vercel resolves to 24.x) |
| `game/server/export-runtime-content.js` | Exports SQLite content for the static game |

The production build command is:

```bash
npm run build:game
```

That command runs the content export and then `vite build`. The deployment
output is `game/dist`.

Generated files under `game/public/content/` are ignored by Git. They are build
artifacts, not another content source.

## Vercel Project Settings

The Vercel project should remain connected to the
`ZanzibarNuclear/atomic-adventures` GitHub repository.

Use these settings:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root |
| Framework Preset | Other |
| Install Command | `npm install` or Vercel default |
| Build Command | Use `vercel.json` (`npm run build:game`) |
| Output Directory | Use `vercel.json` (`game/dist`) |
| Node.js | 24.x |

Do not configure the root as `game/` unless the Vercel build and output settings
are adjusted to their workspace-relative equivalents.

The exact production branch is a Vercel project setting rather than repository
configuration. Keep the branch already used for production unless deliberately
changing the release workflow. Other pushed branches and pull requests can
continue producing Vercel Preview Deployments.

Relevant Vercel documentation:

- [Git deployments](https://vercel.com/docs/deployments/git)
- [Project configuration](https://vercel.com/docs/project-configuration)
- [Configuring builds](https://vercel.com/docs/builds/configure-a-build)
- [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Publishing Content

Authoring remains local for now:

1. Pull the branch that will be edited.
2. Run `npm run dev:game`.
3. Edit story or world content through the local builders.
4. Save and verify changes in a second game window.
5. Run:

   ```bash
   npm run test
   npm run build:game
   ```

6. Confirm `game/content/atomic-adventures.sqlite` is modified.
7. Commit the database together with any code or documentation changes.
8. Push the branch to GitHub.
9. Review the Vercel Preview Deployment.
10. Merge or push to the configured production branch.

There is no separate production content upload. The committed SQLite artifact
is promoted through Git in the same deployment as the application.

YAML snapshots do not reach production until imported into SQLite and committed:

```bash
npm run content:import -w game -- path/to/story.yaml --replace
npm run world:import -w game -- path/to/map.yaml --replace
```

Utility-station geometry is exported from the committed SQLite database to
`game/public/content/utility-station.json` before Vite builds. YAML is available
only as an explicit import/export snapshot format.

## Pre-Deployment Checks

Before merging a production deployment:

```bash
npm run deploy:check
```

Check that:

- `game/dist/content/story.json` exists and contains the expected story revision.
- `game/dist/content/world.json` exists and contains `outdoor-main`.
- `game/dist/content/utility-station.json` exists and contains the utility
  station rooms.
- `game/dist/content/character.json` exists and contains the authored player,
  item, and progression catalogs.
- No `BuilderView` or `WorldBuilderView` JavaScript chunks appear in
  `game/dist/assets`.
- Opening `/builder/story`, `/builder/world`, or `/builder/content` in the production preview
  redirects to `/`.
- A saved local game still loads and the opening story/map render correctly.

For a GA release, consider compressing the committed SQLite content artifact by
removing authoring revision snapshots after the final content audit. The release
build uses the current story/world/building/character/learning documents, not
the revision tables, so history can be pruned deliberately when rollback is
covered by Git tags and release branches.

The production build runs `game/server/verify-production-build.js`
automatically. It fails the Vercel deployment if runtime JSON is absent, content
is empty, builder chunks are emitted, or the browser bundle still depends on
the local authoring API/SSE stream.

## Post-Deployment Smoke Test

After a Vercel preview or production deployment:

1. Open `/` and confirm the map and opening beat load.
2. Move to at least one adjacent hex.
3. Save, reload, and confirm player progress restores.
4. Open `/content/story.json`, `/content/world.json`,
   `/content/utility-station.json`, and `/content/character.json`; all should
   return JSON.
5. Open `/builder/story`, `/builder/world`, and `/builder/content`; all should return to `/`.
6. Check the browser console for failed content requests.

## Rollback

Vercel retains prior deployments. For an urgent application rollback, promote
the previous known-good deployment from the Vercel dashboard.

For a durable Git/content rollback:

1. Revert the problematic commit, including the tracked SQLite file.
2. Push the revert to GitHub.
3. Allow Vercel to build a fresh deployment from the reverted repository state.

Do not attempt to edit the SQLite database inside a deployed Vercel instance;
production content is immutable by design.

## Future Neon Integration

Neon is the selected managed PostgreSQL provider when the project needs
transactional production data. The likely first use is player registration and
accounts, not remote authoring.

Until that feature is designed:

- Vercel needs no database environment variables.
- Player saves remain local to the browser.
- Story and world authoring remain local and Git-promoted.
- SQLite remains canonical for authored content.

When Neon is introduced, keep player/account schema separate from the authored
content model. Remote authoring can later migrate to Neon if needed, retaining
the coarse world-document representation and revision semantics.
