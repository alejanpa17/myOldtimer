# myOldtimer documentation

This folder documents the repository as it exists at commit `f6c13ec3` on
2026-08-07. It is based on the source code, repository configuration, and the
generated `graphify-out` dependency graph.

The documents deliberately distinguish between:

- **Current behavior**: requirements and design that are implemented in the repo.
- **Recommended work**: proposed requirements or engineering improvements that
  are not yet implemented.

## Document map

| Document | Purpose |
| --- | --- |
| [Product requirements](product-requirements.md) | Product goals, users, scope, functional requirements, and acceptance criteria. |
| [Technical design](technical-design.md) | Runtime architecture, module boundaries, routing, persistence, and important workflows. |
| [Data model and privacy](data-model-and-privacy.md) | IndexedDB records, per-vehicle data ownership, migrations, external data flows, and privacy considerations. |
| [Development and operations](development-and-operations.md) | Local setup, environment variables, build, PWA behavior, deployment, and Cloudflare Worker operation. |
| [Quality, risks, and roadmap](quality-risks-and-roadmap.md) | Current validation posture, known limitations, recommended tests, and prioritized next steps. |

## Product at a glance

myOldtimer is a mobile-first, installable vehicle companion. It keeps garage,
maintenance, checklist, fuel, and simulated diagnostic data in the browser. An
optional Gemini integration sends selected vehicle context and chat history to
Google's API to answer maintenance questions, use public workshop-manual URLs,
surface grounded sources and videos, and propose vehicle-profile updates for
explicit user confirmation.

## Evidence and maintenance

The graph report identified 272 nodes, 769 edges, and no import cycles. Its most
connected abstractions are `dbSet`, `dbGet`, `AIChat`, `createId`, `STORAGE_KEYS`,
and `loadGarage`, which matches the source-level architecture described here.

When behavior changes:

1. Update the relevant document in this folder.
2. Run `npm run lint` and `npm run build`.
3. Regenerate `graphify-out` if Graphify is available and compare its commit to
   `git rev-parse HEAD`.
4. Revisit the risk and roadmap status when a limitation is resolved.
