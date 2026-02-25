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
