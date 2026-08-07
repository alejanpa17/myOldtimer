# Quality, risks, and roadmap

## 1. Current quality baseline

The repository has ESLint and a production build, but no automated unit,
component, end-to-end, worker, migration, or accessibility tests. The GitHub Pages
workflow runs the build only. Therefore the current assurance level comes from
static linting, successful compilation, defensive normalization, and manual use.

Positive design signals found in the code and Graphify output include:

- no detected import cycles;
- shared normalization for vehicles, maintenance, checklists, fuel, and AI state;
- explicit confirmation for AI profile changes and simulated relay actions;
- monotonic mileage updates across several features;
- backward-compatible reads for multiple legacy record shapes;
- an external worker constrained to a specific redirect host and path.

## 2. Risk register

| Priority | Risk | Evidence / impact | Recommended response |
| --- | --- | --- | --- |
| High | No backup or restore | Clearing origin data can remove the only copy of all garage records. | Add versioned export/import and recovery guidance. |
| High | Browser-stored Gemini key | IndexedDB/localStorage are not secret stores; same-origin script compromise exposes the key. | Use restricted keys; consider a user-controlled proxy or ephemeral credentials. |
| High | Diagnostics can look real | Battery, RPM, scans, and relay sends are random/local simulations. | Add prominent demo labeling; design a safety-reviewed adapter before real hardware. |
| High | No automated regression suite | Persistence switching and read-time migrations are subtle and central. | Add unit, component, and end-to-end tests; gate deployment. |
| Medium | Dual active/snapshot state | Feature pages write active keys while garage records are snapshots; interrupted writes can diverge. | Move to vehicle-scoped storage or transactional repository operations. |
| Medium | Multi-key operations are not atomic | `Promise.all(dbSet...)` uses separate IndexedDB transactions. | Add domain-level transactions or recoverable reconciliation. |
| Medium | Unhandled storage failures | Many page writes assume IndexedDB succeeds. | Centralize error mapping, retry/recovery, and user feedback. |
| Medium | Image quota pressure | Full image data URLs are stored inside IndexedDB records and snapshots. | Resize/compress, enforce limits, and report quota. |
| Medium | Worker is open to any origin | Wildcard CORS plus no rate limit enables third-party use. | Restrict origins where possible and add abuse controls. |
| Medium | AI model list can age | Model IDs are hard-coded and preview models may disappear. | Validate availability, handle retirement, and maintain a tested support policy. |
| Low | Large feature orchestrators | Graphify shows AI as a broad low-cohesion community; several page files are large. | Extract hooks/reducers/services along domain boundaries. |
| Low | `maintenanceServiceLogs` is unused | The key is snapshotted but no current page uses it, creating ambiguity. | Remove it through migration or document and implement its intended role. |
| Low | Accessibility is unverified | Some labeling exists, but gestures, transitions, modals, and focus behavior lack formal tests. | Add automated checks and keyboard/screen-reader review. |

## 3. Recommended automated test strategy

### Unit tests

Prioritize pure business logic:

- `calculateCategoryState`: boundary day, exact mileage due, overdue, missing
  inputs, combined intervals, and month-end behavior;
- checklist normalization/partitioning and legacy completed entries;
- fuel calculations and legacy normalization (extract normalization if needed);
- mileage parsing and monotonic synchronization;
- vehicle normalization and legacy garage migration;
- AI response parsing, field whitelist/aliases, source extraction, and URL cleanup;
- worker URL validation and YouTube ID parsing.

### Component tests

- vehicle identity validation and cancel behavior;
- maintenance category interval validation;
- adding/editing/deleting history records;
- checklist completion and metadata flows;
- fuel baseline/full/partial entry feedback;
- AI pending-update review, edit, confirmation, and cancellation;
- modal focus, escape behavior, and accessible labels.

Use a controllable IndexedDB implementation or browser test environment rather
than mocking every repository call; storage behavior is part of the product.

### End-to-end tests

The highest-value scenario is vehicle isolation:

1. Create vehicle A and populate every domain.
2. Create vehicle B with different values.
3. Switch between them across reloads.
4. Confirm profiles, histories, checklist, fuel, chat, and manuals never leak.

Also cover GitHub Pages subpath routing, PWA update/offline behavior, legacy data
migration, failed storage, Gemini error responses, and Worker failures.

### CI gates

A pull request and deployment pipeline should run, in order:

1. dependency install with `npm ci`;
2. lint;
3. unit/component tests with coverage;
4. production build;
5. a small end-to-end smoke suite against the built app.

## 4. Proposed roadmap

### Phase 1: Protect user data and establish confidence

- Add export/import with a documented schema version.
- Add a test runner and unit coverage for maintenance, checklist, mileage, garage,
  fuel, and AI parsing.
- Add end-to-end multi-vehicle isolation coverage.
- Run lint and tests before GitHub Pages deployment.
- Present consistent storage failure messages.

Exit criterion: a user can back up and restore the garage, and core data flows are
CI-gated.

### Phase 2: Simplify persistence and lifecycle

- Introduce a vehicle-scoped repository abstraction.
- Plan and migrate away from duplicated active keys.
- Add vehicle deletion and cache/key cleanup.
- Add runtime schemas and a centralized migration version.
- Compress/resize vehicle images and expose storage usage.

Exit criterion: each write has an explicit vehicle owner and migrations are tested
from supported prior versions.

### Phase 3: Harden integrations

- Clearly label diagnostics as Demo until real hardware exists.
- Define an OBD transport interface, supported devices, failure states, and safety
  requirements before implementation.
- Decide on an AI credential model and document external disclosures in-product.
- Harden the Worker with origin/rate/payload policies and monitoring.
- Add graceful model availability/retirement handling.

Exit criterion: external features have documented trust boundaries, predictable
failure handling, and operational controls.

### Phase 4: Product depth

- Maintenance reminders and notification preferences.
- CSV/report exports, currency/unit preferences, and richer fuel analytics.
- Additional parts providers behind a provider adapter.
- Optional sync only after identity, conflict resolution, encryption, and deletion
  requirements are agreed.

## 5. Architecture decision records worth adding

As the project grows, add `docs/adr/` entries for decisions with lasting tradeoffs:

- local-only versus optional cloud sync;
- vehicle-scoped persistence migration;
- AI credential and request architecture;
- supported diagnostic transport and safety model;
- router strategy for static subpath hosting;
- backup format and schema compatibility policy.

Each ADR should record context, decision, alternatives, consequences, and status.

## 6. Documentation still worth writing

Beyond this initial set, useful additions are:

- end-user guide with annotated mobile workflows;
- troubleshooting guide for PWA updates, storage permissions, and AI errors;
- data export/import schema once implemented;
- diagnostic protocol and safety specification before hardware integration;
- accessibility checklist and supported-browser matrix;
- release process, changelog policy, and incident/recovery runbook;
- contribution guide and code conventions;
- ADRs for the decisions listed above.
