# Data model and privacy

## 1. Storage overview

Application data is stored on the user's device in IndexedDB database
`myoldtimer-db`, object store `keyval`. AI settings additionally have a namespaced
`localStorage` fallback (`myoldtimer-fallback:<storage-key>`).

Browser storage is origin-specific. A localhost build, a GitHub Pages deployment,
and a deployment on another domain do not share data. Clearing site data,
uninstalling browser data, private browsing policies, or storage eviction can
remove records. The current app has no backup or restore feature.

## 2. Vehicle aggregate

The `vehicles` key contains an array of records with this conceptual shape:

```js
{
  id: "vehicle-<timestamp>-<random>",
  info: {
    vin, brand, model, generation, engine, fuelType, gearbox,
    modelYear, drive, steering, region, exteriorColor,
    interiorColor, horsepower
  },
  image: "data:image/..." | null,
  mileage: number | "",
  data: {
    diagnosticsConnected: boolean,
    currentFaultCodes: [],
    faultHistory: [],
    replaceHistory: [],
    maintenanceHistory: [],
    maintenanceCategories: [],
    maintenanceServiceLogs: [],
    checklistData: { todo: [], done: [] },
    fuelEfficiencyEntries: [],
    fuelEfficiencyMode: "odometer" | "trip",
    aiChatLog: [],
    aiManualUrls: []
  },
  createdAt: "ISO-8601 timestamp",
  updatedAt: "ISO-8601 timestamp"
}
```

`selectedVehicleId` identifies the active aggregate. The same active vehicle is
also projected onto individual storage keys so existing pages can read feature
data without a vehicle ID. See the technical design for the switch/snapshot flow.

## 3. Storage-key catalog

| Key | Ownership | Value |
| --- | --- | --- |
| `vehicles` | Garage | Array of complete vehicle snapshots |
| `selectedVehicleId` | Garage | Active vehicle ID |
| `vehicleInfo` | Active vehicle mirror | Profile object |
| `vehicleImage` | Active vehicle mirror | Data URL or `null` |
| `maintenanceCurrentMileage` | Active vehicle mirror | Number or blank string |
| `diagnosticsConnected` | Per vehicle | Simulated connection boolean |
| `currentFaultCodes` | Per vehicle | Current `{code, name}` records |
| `faultHistory` | Per vehicle | Detected fault records |
| `replaceHistory` | Per vehicle | Replacement records |
| `maintenanceHistory` | Per vehicle | Service-entry records |
| `maintenanceCategories` | Per vehicle | Interval/category records |
| `maintenanceServiceLogs` | Per vehicle/reserved | Present in snapshots but not used by current pages |
| `checklistData` | Per vehicle | `{todo, done}` task lists |
| `fuelEfficiencyEntries` | Per vehicle | Refuel records and calculated metrics |
| `fuelEfficiencyMode` | Per vehicle | Last selected distance-input mode |
| `expenseCurrency` | Active/global setting | Expense display currency code |
| `aiChatLog` | Per vehicle | Sanitized user/AI messages and source/video metadata |
| `aiManualUrls` | Per vehicle | Public workshop-manual URL records |
| `aiApiKey` | Active/global setting | Gemini API key |
| `aiModel` | Active/global setting | Selected model ID |
| `aiTemperature` | Active/global setting | Number clamped to 0–2 |
| `aiMaxOutputTokens` | Active/global setting | Positive integer |
| `aiVideoThumbnailsEnabled` | Active/global setting | Boolean |
| `aiVideoThumbnailCache` | Active/global cache | Thumbnail metadata keyed by video |
| `aiVideoRedirectCacheV2` | Active/global cache | Redirect-resolution metadata |
| `aiDebug` | Active/global setting | Boolean |

“Active/global” means the key is not included in each vehicle snapshot. Those
settings therefore remain in effect when switching vehicles.

## 4. Domain record shapes

### Maintenance category

```js
{
  id,
  name,
  intervalType: "time" | "mileage" | "both",
  intervalMonths: number | null,
  intervalKilometers: number | null,
  lastServiceDate: "YYYY-MM-DD" | "",
  lastServiceMileage: number | null,
  createdAt,
  updatedAt
}
```

The overview normally derives last-service values from the newest linked history
entry. Stored category values are fallback compatibility fields.

### Maintenance history

```js
{ id, categoryIds: string[], categories: string[], date, kilometers, comment }
```

`categories` is a name snapshot for display/migration; `categoryIds` is the
relationship used by current code. Maintenance history records also carry an
optional `cost: number | null` field.

### Replacement history

```js
{
  id,
  parts: string[],
  partItems: [{ id, name, price: number | null }],
  date,
  kilometers,
  comment
}
```

`parts` remains as a compatibility name snapshot. New UI reads and writes
`partItems` so each replaced part can have its own price.

### Checklist

```js
{
  todo: [{
    id,
    taskName,
    subtasks: [{ id, name, isDone, completedDate, completedKilometers, cost }]
  }],
  done: [/* same task shape; every subtask is done */]
}
```

### Fuel entry

```js
{
  id,
  date,
  distanceInputType: "odometer" | "trip",
  odometerValue: number | null,
  distanceDriven: number | null,
  liters: number | null,
  totalPrice: number | null,
  isFullTank: boolean,
  calculatedConsumption: number | null,
  costPerKm: number | null,
  costPer100Km: number | null,
  createdAt
}
```

### Fault history

```js
{ id, code, name, detectedAt, mileage }
```

### AI chat message and manual

```js
{
  id,
  role: "user" | "ai",
  text,
  sources: [{ uri, title }],
  videos: [{ videoId, url, sourceUrl, title, thumbnailUrl, thumbnailSrc, loading }]
}

{ id, title, url, createdAt }
```

## 5. Data invariants

- Vehicle mileage is blank or non-negative.
- Cross-feature mileage synchronization only increases mileage.
- Maintenance intervals required by their interval type are positive.
- A maintenance entry must select at least one existing category.
- A replacement entry must contain at least one part.
- A checklist task must contain a name and at least one named subtask.
- A task is in `done` only when it has subtasks and all are complete.
- Odometer fuel readings do not decrease relative to the last odometer entry.
- AI profile updates are limited to known vehicle fields and require confirmation.

These rules currently live in UI handlers and normalizers rather than a single
schema layer, so direct future writes must preserve them explicitly.

## 6. External data flows

### Gemini

When the user sends a message, the browser sends to Google's Gemini API:

- the API key as a query parameter over HTTPS;
- a reduced profile context: model, generation, engine, year, region, brand, VIN;
- the chat conversation;
- public workshop-manual URLs, when configured;
- the system instruction and generation settings.

Gemini may then retrieve manual URLs using URL Context and web results using Google
Search grounding. Users should not add private or access-controlled manual URLs.

### Video resolver

If configured, grounded redirect URLs may be POSTed to the Cloudflare Worker. The
worker follows them and may call YouTube oEmbed to obtain titles. The Worker accepts
cross-origin requests from any origin; it does not store application records in
the current implementation.

### Parts provider

PartSouq receives the VIN as a URL query when the user opens a parts search. This
navigation is explicit and happens in a new tab.

## 7. Privacy and security notes

- “Local-only” applies to core stored records, not to optional external actions.
- IndexedDB and `localStorage` are not encrypted vaults. Any script executing on
  the same origin can potentially access them.
- The Gemini API key is persisted in browser storage and used directly by the
  client. Users should use a restricted, revocable key and understand that a
  public frontend cannot keep a static secret confidential.
- VINs can identify a vehicle and may be sent to Gemini or PartSouq depending on
  the user's actions.
- Vehicle photos stored as data URLs can consume significant browser quota.
- AI output is advisory and may be wrong. Profile changes require confirmation,
  but repair and safety decisions still require authoritative documentation and
  qualified judgment.
- The simulated relay UI must not be reused for real actuators without transport
  authentication, state validation, safety interlocks, timeouts, and threat
  analysis.

## 8. Recommended data improvements

1. Add a versioned export/import envelope with schema version, export time, and
   validation errors.
2. Define runtime schemas for every record and validate at persistence boundaries.
3. Replace dual snapshot/active keys with explicitly vehicle-scoped persistence.
4. Add quota monitoring and image resizing/compression before storage.
5. Document retention and deletion behavior, including caches and API keys.
6. Treat external data disclosure as an explicit consent surface in the UI.
