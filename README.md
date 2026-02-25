# myOldtimer

Mobile-first PWA for local vehicle management and garage workflows.

## Features

- Digital vehicle profile with locally stored photo and editable fields
- Diagnostics overview with connection state and simulated live values
- Fault code scan + history view
- Relay tester with confirmation and status response
- Maintenance overview + replace/history CRUD flows
- Checklist module with To-Do/Done tabs and task subtasks
- Parts Finder redirect using VIN query parameter
- AI chat placeholder UI (no backend integration)
- Offline-ready service worker (Vite PWA plugin)
- All user data stored locally in IndexedDB

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

The repository includes a workflow at `.github/workflows/deploy-pages.yml` that deploys on every push to `main`.

1. Push your latest commit to `main`.
2. In GitHub, open `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Wait for workflow **Deploy to GitHub Pages** to finish.
5. Open `https://<your-username>.github.io/<your-repo-name>/` on your phone.

### Local build with GitHub Pages base path

Use this when you want to test the same build behavior locally:

```powershell
$env:VITE_BASE_PATH="/myOldtimer/"
npm run build
```
