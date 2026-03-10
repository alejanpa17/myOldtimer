# myOldtimer

Mobile-first Progressive Web App (PWA) for local vehicle management and garage workflows.

## Live URL

https://alejanpa17.github.io/myOldtimer/

## Core Features

- Vehicle profile and photo (camera/gallery upload)
- Diagnostics, fault codes, and relay tester UI
- Maintenance overview and history tracking
- Replace history tracking
- Checklist with tasks/subtasks
- Fuel efficiency logging
- Parts finder using VIN redirect
- AI chat placeholder screen
- Offline-capable PWA
- Local-only data storage (IndexedDB)

## Stack

- React + Vite
- React Router
- IndexedDB (custom key-value wrapper)
- Vite PWA plugin

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run lint
npm run build
```

## Deploy to GitHub Pages

This repo uses `.github/workflows/deploy-pages.yml` and deploys on every push to `main`.

1. Push your latest commit to `main`.
2. In GitHub, open `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions` (one-time).
4. Wait for workflow **Deploy to GitHub Pages** to finish.
5. Open `https://<your-username>.github.io/<your-repo-name>/` on your phone.

## Optional: Local Pages Build

```powershell
$env:VITE_BASE_PATH="/myOldtimer/"
npm run build
```

## Optional: YouTube Resolver (Cloudflare Worker)

To resolve Google Search grounding redirect URLs into YouTube video IDs, set:

```powershell
$env:VITE_VIDEO_RESOLVER_URL="https://myoldtimer-video-resolver.alejandro170999.workers.dev"
```

The worker should accept `POST` JSON:

```json
{"url":"<vertexaisearch redirect url>"}
```

And return JSON with at least:

```json
{"videoId":"<id>","title":"<video title>","url":"<youtube url>"}
```

Batch support is also expected:

```json
{"urls":["<redirect url 1>","<redirect url 2>"]}
```

```json
{"results":[{"url":"<redirect url>","resolvedUrl":"<youtube url>","videoId":"<id>","title":"<title>"}]}
```
