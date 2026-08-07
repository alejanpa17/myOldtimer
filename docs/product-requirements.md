# Product requirements

## 1. Purpose

myOldtimer gives a classic-car owner one mobile workspace for vehicle identity,
service planning, work history, checklists, refuelling, parts lookup, diagnostic
experiments, and AI-assisted research. The core record remains available locally
and offline after the PWA assets have been cached.

This is an **as-built product specification**. Statements under “Recommended
requirements” are proposals, not current capabilities.

## 2. Intended users and jobs

### Primary user

An owner or hands-on maintainer of one or more older vehicles who wants to:

- remember vehicle specifications and current mileage;
- know which maintenance items are due;
- retain service, replacement, checklist, and fuel history;
- find parts using a VIN;
- research repairs with vehicle-aware AI assistance;
- use the experience primarily from a phone, including as an installed PWA.

### Current operating assumptions

- The app is single-user and single-device unless browser data is moved manually.
- No account, cloud sync, server database, or multi-user collaboration exists.
- Most data is local to the browser profile and origin.
- Diagnostic device behavior is simulated; it is not a real OBD interface.
- AI is optional and requires a user-provided Gemini API key and network access.

## 3. Functional requirements currently implemented

### FR-1: Garage and active vehicle

- The user can create multiple vehicle records.
- A new vehicle must contain at least one of VIN, brand, or model.
- The profile supports VIN, brand, model, generation, engine, fuel type, gearbox,
  model year, drive, steering, region, exterior/interior color, and horsepower.
- Mileage must be blank or a non-negative number.
- A vehicle photo can be selected from camera/gallery, stored as a data URL, and
  later updated or removed.
- The user can select a vehicle from the garage. Selecting the already-active
  vehicle opens its profile; selecting another makes it active and returns home.
- Feature data such as histories, checklist, fuel entries, chat, and manuals is
  preserved independently per vehicle through vehicle snapshots.
- Legacy single-vehicle data is migrated into the garage when possible.

Acceptance examples:

- Saving a vehicle with no VIN, brand, and model is rejected.
- Switching from vehicle A to B saves A's active feature state before loading B.
- Returning to A restores A's histories and checklist.

### FR-2: Home dashboard and navigation

- The home screen shows the active vehicle name, selected profile metadata,
  photo, odometer, maintenance summary, and checklist counts.
- The bottom navigation exposes Garage, Service, Checklist, Parts, Fuel, and AI.
- Horizontal swipe gestures move between primary tabs when the gesture did not
  start on an interactive control.
- Route transitions indicate forward/back navigation.
- Diagnostics remains reachable through `/diagnosis` or `/diagnostics`, although
  it is not a primary bottom-navigation item.

### FR-3: Maintenance planning

- On first use, the app creates default categories for engine oil, brake fluid,
  coolant, air filter, and timing belt.
- The user can add, edit, select, and delete maintenance categories.
- Each category has a time, mileage, or combined interval.
- A time interval requires positive months; a mileage interval requires positive
  kilometres.
- The overview derives the latest service state from linked history entries and
  calculates next due date/mileage, progress, and status.
- Status priority is Overdue, Due Soon, Needs Setup, then OK.
- “Due soon” means within 30 days for time or within the last 10% of a mileage
  interval. A combined category uses the most urgent result.

### FR-4: Maintenance and replacement history

- A maintenance entry can link one or more maintenance categories and record a
  date, mileage, optional cost, and comment.
- A replacement entry can record one or more part names with an optional price
  for each part, plus date, mileage, and comment.
- Entries can be added, edited, selected, and deleted.
- Lists are displayed newest first.
- A valid recorded mileage raises the active vehicle mileage only when it is
  higher; historical entries cannot reduce the odometer.
- Older name-based maintenance and replacement records are normalized to the
  current structures when read.

### FR-5: Checklist

- A task requires a name and at least one named subtask.
- Tasks and subtasks can be created and edited; tasks can be selected and deleted.
- Completing every subtask moves a task from To-Do to Done; reopening a subtask
  moves the task back as needed.
- A completed subtask can carry an optional completion date, mileage, and cost.
- A recorded completion mileage can increase the active vehicle mileage.
- Legacy completed-task records are normalized when loaded.

### FR-6: Fuel efficiency

- The user can log refuels using either an odometer reading or trip distance.
- An entry records date, litres, optional total price, full/partial tank status,
  distance, and calculated metrics.
- Litres and distance must be positive. Price, when supplied, must be positive.
- Odometer entries cannot be lower than the last saved odometer entry.
- The first odometer entry is a baseline and cannot produce a full-tank
  consumption calculation without a prior reading.
- Full-tank entries calculate L/100 km and, when price exists, cost/km and
  cost/100 km.
- The average uses only valid full-tank consumption entries.
- A higher odometer reading updates the active vehicle mileage.

### FR-7: Parts lookup

- The Parts Finder loads the active vehicle VIN and allows a non-empty VIN to be
  saved.
- A saved VIN enables a PartSouq search in a new browser tab.
- The app URL-encodes the VIN and opens the provider with `noopener,noreferrer`.

### FR-8: Diagnostic prototype

- The user can toggle a persisted simulated connection state.
- While connected, the UI generates sample battery voltage and RPM values.
- A fault-code scan randomly selects zero to three codes from a small local
  catalog and persists results and detected history.
- The relay tester asks for confirmation before reporting a simulated fuel-pump
  or cooling-fan command as sent.
- Scanning and relay commands are blocked while disconnected.

This requirement is explicitly a UI prototype. It must not be interpreted as
real vehicle communication or a safety-certified control.

### FR-9: AI assistant

- The user can save a Gemini API key, supported model, temperature, maximum output
  tokens, debug flag, and video-thumbnail preference locally.
- Sending is blocked for empty messages, missing credentials, concurrent sends,
  or a pending vehicle-profile proposal.
- Requests include a system instruction, a reduced active-vehicle context, chat
  history, and optional public workshop-manual URLs.
- `gemini-2.5-flash` enables Google Search grounding; configured manual URLs enable
  URL Context.
- Responses are normalized to plain text and may retain grounded source metadata.
- Grounded YouTube results can show thumbnails. Redirect URLs may be resolved by
  the optional Cloudflare Worker.
- The AI may propose a whitelist of vehicle fields. The app presents previous and
  proposed values and applies them only after user confirmation.
- Chat history and workshop-manual URLs are stored per vehicle. Core AI settings
  are device-wide active keys.

### FR-10: Expense tracking

- Fuel total prices, maintenance costs, individual replacement-part prices, and
  completed checklist-subtask costs contribute to the active vehicle's expenses.
- The Expenses screen shows all-time and current-year totals, a category
  breakdown, the last 12 months, and a recent-expense ledger.
- The user can choose EUR, USD, GBP, or CHF as the display currency. Changing the
  currency changes the display unit and does not perform exchange-rate conversion.
- Existing records without price fields remain valid and contribute no expense.

### FR-11: Local persistence and offline shell

- Application records are stored in IndexedDB in a single key-value object store.
- AI settings also use namespaced `localStorage` as a fallback if IndexedDB access
  fails.
- The service worker updates automatically and precaches built HTML, JavaScript,
  CSS, PNG, and SVG assets.
- External provider pages, Gemini requests, workshop manuals, and video resolution
  still require network access.

## 4. Non-functional requirements inferred from the implementation

- **Mobile usability:** layouts, bottom navigation, gestures, large controls, and
  standalone PWA metadata prioritize small touch screens.
- **Local-first operation:** normal garage workflows do not depend on an app
  backend.
- **Compatibility:** the target browser must support React's runtime needs,
  IndexedDB, service workers, FileReader, and modern URL/fetch APIs.
- **Data integrity:** input normalization supports older stored shapes, and mileage
  synchronization is monotonic.
- **User control:** destructive list actions require selection/manage flows, relay
  commands require confirmation, and AI profile changes require review.
- **Deployability:** the same build supports a root origin and a GitHub Pages
  subpath.

## 5. Out of scope today

- Accounts, authentication, authorization, sharing, and cloud synchronization.
- Real Bluetooth/serial/OBD communication.
- Automatic VIN decoding or parts catalog ingestion.
- Data import/export, backup, restore, and cross-device migration.
- Vehicle deletion.
- Server-side protection of AI credentials or AI request proxying.
- Automated tests and formal accessibility or browser compatibility certification.

## 6. Recommended requirements

These are the strongest next product requirements suggested by the code and graph:

1. **Backup and restore:** export all user data to a versioned JSON file and import
   it with validation, preview, and conflict handling.
2. **Vehicle lifecycle:** support vehicle deletion with explicit confirmation and
   a clear policy for the last remaining vehicle.
3. **Real diagnostics boundary:** either integrate a well-defined supported OBD
   adapter protocol or label/isolate every diagnostic route as a demo mode.
4. **Credential safety:** avoid treating a browser-stored API key as protected;
   optionally add a user-operated proxy or short-lived token design.
5. **Maintenance notifications:** use local notifications when supported, with
   permissions and scheduling controlled by the user.
6. **Data portability:** document units and locale, support currency selection,
   and provide CSV export for histories and fuel entries.
7. **Resilience:** surface storage quota/permission failures consistently and
   provide recovery guidance.
8. **Accessibility:** test keyboard flow, focus trapping, reduced motion, labels,
   contrast, and screen-reader announcements.
