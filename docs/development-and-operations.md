# Development and operations

## 1. Prerequisites

- Node.js 20 (the CI workflow uses Node 20)
- npm
- A modern browser with IndexedDB and service-worker support
- Optional: a Gemini API key for AI features
- Optional: Wrangler/Cloudflare account for the video resolver

## 2. Local development

```powershell
npm install
npm run dev
```

Vite prints the local URL. A root-base development build uses `BrowserRouter`.
Data written locally belongs to that development origin and is separate from the
deployed GitHub Pages origin.

Available scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run ESLint across the repository |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |

There is currently no `test` script.

## 3. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BASE_PATH` | No | Static deployment base, normalized to leading/trailing slashes |
| `VITE_VIDEO_RESOLVER_URL` | No | Cloudflare Worker URL for grounded-video redirects |

Example GitHub Pages-style local build:

```powershell
$env:VITE_BASE_PATH="/myOldtimer/"
npm run build
```

Example resolver configuration:

```powershell
$env:VITE_VIDEO_RESOLVER_URL="https://<worker>.<account>.workers.dev"
npm run build
```

`VITE_*` values are embedded in the client bundle at build time. They are public
configuration, not secrets. The Gemini API key is entered at runtime in the app;
do not place it in a committed `.env` file.

## 4. Validation before merge

Run:

```powershell
npm run lint
npm run build
```

Until automated tests exist, manually smoke-test at least:

1. Add two vehicles, enter distinct feature data, switch twice, and confirm data
   isolation.
2. Add a maintenance category and history entry; verify due-state changes.
3. Complete and reopen a checklist subtask.
4. Save odometer and trip-mode fuel entries and verify calculations.
5. Reload offline after one successful online load and verify local screens.
6. If AI changed, test missing-key, normal response, manual URL, sources, and
   proposed-profile confirmation/cancellation.
7. If base-path behavior changed, preview both `/` and a subpath build.

## 5. PWA behavior

The Vite PWA plugin generates a manifest with standalone display, dark theme, and
192×192/512×512 icons. `registerSW({ immediate: true })` registers the generated
service worker and `registerType: "autoUpdate"` asks it to update automatically.

Workbox precaches built files matching:

```text
**/*.{js,css,html,png,svg}
```

This provides an offline application shell and local workflows. It does not make
Gemini, PartSouq, public manual URLs, external favicons, Google redirects, or
YouTube available offline.

When debugging a stale UI, inspect the registered service worker and Cache Storage,
then reload after the new worker activates. Avoid treating a local browser cache
problem as a persistence migration until IndexedDB has been inspected separately.

## 6. GitHub Pages deployment

`.github/workflows/deploy-pages.yml` runs on pushes to `main` and manual dispatch:

1. Check out the repository.
2. Install Node 20 with npm caching.
3. Run `npm ci`.
4. Run `npm run build` with `VITE_BASE_PATH=/<repository-name>/`.
5. Upload `dist/` as a Pages artifact.
6. Deploy through the `github-pages` environment.

The subpath build selects `HashRouter`, so deep links are represented after `#`
and do not require a Pages rewrite rule.

The workflow builds but does not currently run ESLint or automated tests. Adding
those as required steps is recommended.

## 7. Cloudflare Worker

`wrangler.toml` defines worker `myoldtimer-video-resolver` with entry point
`worker/cloudflare-video-resolver.js`.

Deploy from an authenticated Wrangler environment:

```powershell
npx wrangler deploy
```

Request forms:

```json
{"url":"<vertexaisearch grounding redirect URL>"}
```

```json
{"urls":["<redirect URL 1>","<redirect URL 2>"]}
```

Representative success responses:

```json
{"url":"<input>","resolvedUrl":"<youtube URL>","videoId":"<id>","title":"<title>"}
```

```json
{"results":[{"url":"<input>","resolvedUrl":"<youtube URL>","videoId":"<id>","title":"<title>"}]}
```

Operational characteristics:

- `OPTIONS` returns 204; non-POST methods return 405.
- Only Google Vertex AI grounding redirect URLs are accepted.
- Redirect following times out after 12 seconds.
- YouTube title lookup times out after 8 seconds and may return an empty title.
- A batch resolves entries concurrently with `Promise.all`.
- CORS currently permits every origin.

Before operating this endpoint at scale, add origin policy, rate limiting,
observability, abuse controls, payload-size limits, and a documented service-level
expectation.

## 8. Graphify maintenance

`graphify-out/` and the local Graphify tool directories are ignored by Git. The
current report was built from the same commit documented here. After structural
code changes, regenerate the graph locally and check:

- whether `dbGet`/`dbSet` remain extreme hubs;
- whether new import cycles appear;
- whether AI or page communities need smaller modules;
- whether isolated nodes reflect missing extraction or genuinely unused code.
