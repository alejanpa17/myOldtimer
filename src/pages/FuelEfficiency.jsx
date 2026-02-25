import { useEffect, useMemo, useState } from "react";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import { syncMileageIfHigher } from "../lib/mileage";

const DISTANCE_MODE = {
  odometer: "odometer",
  trip: "trip",
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultForm() {
  return {
    date: todayIsoDate(),
    liters: "",
    totalPrice: "",
    isFullTank: true,
    odometerValue: "",
    tripDistance: "",
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const normalized = String(value).replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries.map((entry, index) => {
    if (entry?.distanceInputType === DISTANCE_MODE.odometer || entry?.distanceInputType === DISTANCE_MODE.trip) {
      return {
        id: entry.id || createId("fuel"),
        date: entry.date || todayIsoDate(),
        distanceInputType: entry.distanceInputType,
        odometerValue: toNumber(entry.odometerValue),
        distanceDriven: toNumber(entry.distanceDriven),
        liters: toNumber(entry.liters),
        totalPrice: toNumber(entry.totalPrice),
        isFullTank: Boolean(entry.isFullTank),
        calculatedConsumption: toNumber(entry.calculatedConsumption),
        costPerKm: toNumber(entry.costPerKm),
        costPer100Km: toNumber(entry.costPer100Km),
        createdAt: entry.createdAt || `${todayIsoDate()}T00:00:00.000Z`,
      };
    }

    return {
      id: entry?.id || `fuel-legacy-${index}`,
      date: entry?.date || todayIsoDate(),
      distanceInputType: DISTANCE_MODE.trip,
      odometerValue: null,
      distanceDriven: toNumber(entry?.kilometers),
      liters: null,
      totalPrice: null,
      isFullTank: Boolean(entry?.refueled),
      calculatedConsumption: null,
      costPerKm: null,
      costPer100Km: null,
      createdAt: entry?.createdAt || `${todayIsoDate()}T00:00:00.000Z`,
    };
  });
}

function formatMetric(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return Number(value).toFixed(decimals);
}

function FuelEfficiency() {
  const [distanceMode, setDistanceMode] = useState(DISTANCE_MODE.odometer);
  const [form, setForm] = useState(createDefaultForm);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.fuelEfficiencyEntries, []),
      dbGet(STORAGE_KEYS.fuelEfficiencyMode, DISTANCE_MODE.odometer),
    ]).then(([storedEntries, storedMode]) => {
      if (!mounted) {
        return;
      }

      const normalizedEntries = normalizeEntries(storedEntries);
      setEntries(normalizedEntries);
      if (
        storedMode === DISTANCE_MODE.odometer ||
        storedMode === DISTANCE_MODE.trip
      ) {
        setDistanceMode(storedMode);
      }

      if (normalizedEntries.length !== storedEntries.length) {
        dbSet(STORAGE_KEYS.fuelEfficiencyEntries, normalizedEntries);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const keyA = `${a.date}-${a.createdAt}`;
      const keyB = `${b.date}-${b.createdAt}`;
      return keyB.localeCompare(keyA);
    });
  }, [entries]);

  const lastOdometerValue = useMemo(() => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const value = toNumber(entries[index].odometerValue);
      if (value !== null && value >= 0) {
        return value;
      }
    }
    return null;
  }, [entries]);

  const litersValue = toNumber(form.liters);
  const totalPriceValue = toNumber(form.totalPrice);
  const odometerValue = toNumber(form.odometerValue);
  const tripDistanceValue = toNumber(form.tripDistance);

  const summary = useMemo(() => {
    const errors = [];
    const warnings = [];
    const hasPriceInput = form.totalPrice.trim() !== "";
    let distanceDriven = null;

    if (!form.date) {
      errors.push("Date is required.");
    }

    if (litersValue === null || litersValue <= 0) {
      errors.push("Fuel amount must be greater than 0.");
    }

    if (hasPriceInput && (totalPriceValue === null || totalPriceValue <= 0)) {
      errors.push("Total price must be greater than 0 when provided.");
    }

    if (distanceMode === DISTANCE_MODE.odometer) {
      if (odometerValue === null) {
        errors.push("Current odometer reading is required.");
      } else if (lastOdometerValue !== null && odometerValue < lastOdometerValue) {
        errors.push(
          `Current odometer must be at least ${formatMetric(lastOdometerValue, 0)} km.`
        );
      } else if (lastOdometerValue !== null) {
        distanceDriven = Number((odometerValue - lastOdometerValue).toFixed(2));
        if (distanceDriven <= 0) {
          errors.push("Distance since last refuel must be greater than 0.");
        }
      } else {
        warnings.push(
          "No previous odometer entry found. This will be saved as a baseline entry."
        );
      }
    } else {
      if (tripDistanceValue === null || tripDistanceValue <= 0) {
        errors.push("Distance driven must be greater than 0 in Trip mode.");
      } else {
        distanceDriven = Number(tripDistanceValue.toFixed(2));
      }
    }

    if (form.isFullTank && (distanceDriven === null || distanceDriven <= 0)) {
      errors.push(
        "Full tank calculations require a valid distance. Use Trip mode or a previous odometer entry."
      );
    }

    const calculatedConsumption =
      form.isFullTank && distanceDriven && litersValue
        ? Number(((litersValue / distanceDriven) * 100).toFixed(2))
        : null;

    const costPerKm =
      form.isFullTank && distanceDriven && hasPriceInput && totalPriceValue
        ? Number((totalPriceValue / distanceDriven).toFixed(4))
        : null;

    const costPer100Km =
      costPerKm !== null ? Number((costPerKm * 100).toFixed(2)) : null;

    return {
      errors,
      warnings,
      distanceDriven,
      calculatedConsumption,
      costPerKm,
      costPer100Km,
    };
  }, [
    distanceMode,
    form.date,
    form.isFullTank,
    form.totalPrice,
    lastOdometerValue,
    litersValue,
    odometerValue,
    totalPriceValue,
    tripDistanceValue,
  ]);

  const averageConsumption = useMemo(() => {
    const validEntries = entries.filter(
      (entry) =>
        entry.isFullTank &&
        entry.calculatedConsumption !== null &&
        entry.calculatedConsumption > 0
    );
    if (!validEntries.length) {
      return null;
    }
    const total = validEntries.reduce(
      (acc, entry) => acc + entry.calculatedConsumption,
      0
    );
    return total / validEntries.length;
  }, [entries]);

  const shouldShowPartialGuidance = useMemo(() => {
    const recent = entries.slice(-6);
    if (recent.length < 4) {
      return false;
    }
    const partialCount = recent.filter((entry) => !entry.isFullTank).length;
    return partialCount / recent.length >= 0.6;
  }, [entries]);

  const onChangeMode = (nextMode) => {
    setDistanceMode(nextMode);
    dbSet(STORAGE_KEYS.fuelEfficiencyMode, nextMode);
    setStatus("");
  };

  const saveRefuel = async () => {
    if (summary.errors.length > 0) {
      setStatus(summary.errors[0]);
      return;
    }

    const hasPriceInput = form.totalPrice.trim() !== "";
    const entry = {
      id: createId("fuel"),
      date: form.date,
      distanceInputType: distanceMode,
      odometerValue: distanceMode === DISTANCE_MODE.odometer ? odometerValue : null,
      distanceDriven: summary.distanceDriven,
      liters: litersValue,
      totalPrice: hasPriceInput ? totalPriceValue : null,
      isFullTank: form.isFullTank,
      calculatedConsumption: summary.calculatedConsumption,
      costPerKm: summary.costPerKm,
      costPer100Km: summary.costPer100Km,
      createdAt: new Date().toISOString(),
    };

    const nextEntries = [...entries, entry];
    await dbSet(STORAGE_KEYS.fuelEfficiencyEntries, nextEntries);
    await syncMileageIfHigher(entry.odometerValue);
    setEntries(nextEntries);
    setForm(createDefaultForm());
    setStatus("Refuel saved locally.");
  };

  return (
    <main className="page page-with-sticky-cta">
      <h2 className="page-title">Fuel Efficiency</h2>

      <section className="card stack">
        <h3 className="item-title" style={{ marginBottom: 2 }}>
          Distance Input Method
        </h3>
        <div className="segmented">
          <button
            type="button"
            className={distanceMode === DISTANCE_MODE.odometer ? "tab-active" : ""}
            onClick={() => onChangeMode(DISTANCE_MODE.odometer)}
          >
            Odometer
          </button>
          <button
            type="button"
            className={distanceMode === DISTANCE_MODE.trip ? "tab-active" : ""}
            onClick={() => onChangeMode(DISTANCE_MODE.trip)}
          >
            Trip Distance
          </button>
        </div>
      </section>

      <section className="card field-grid" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="liters" className="label">
            Fuel amount (liters)
          </label>
          <input
            id="liters"
            type="number"
            inputMode="decimal"
            className="input input-large"
            min="0"
            step="0.01"
            value={form.liters}
            onChange={(event) =>
              setForm((current) => ({ ...current, liters: event.target.value }))
            }
          />
        </div>

        <div>
          <label htmlFor="date" className="label">
            Date
          </label>
          <input
            id="date"
            type="date"
            className="input input-large"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value }))
            }
          />
        </div>

        <div>
          <label htmlFor="price" className="label">
            Total price (optional)
          </label>
          <input
            id="price"
            type="number"
            inputMode="decimal"
            className="input input-large"
            min="0"
            step="0.01"
            value={form.totalPrice}
            onChange={(event) =>
              setForm((current) => ({ ...current, totalPrice: event.target.value }))
            }
          />
        </div>

        {distanceMode === DISTANCE_MODE.odometer && (
          <div>
            <label htmlFor="odometerValue" className="label">
              Current odometer reading
            </label>
            <input
              id="odometerValue"
              type="number"
              inputMode="numeric"
              className="input input-large"
              min="0"
              step="1"
              value={form.odometerValue}
              onChange={(event) =>
                setForm((current) => ({ ...current, odometerValue: event.target.value }))
              }
            />
            <p className="item-row">
              Last odometer:{" "}
              {lastOdometerValue === null
                ? "No previous entry"
                : `${formatMetric(lastOdometerValue, 0)} km`}
            </p>
          </div>
        )}

        {distanceMode === DISTANCE_MODE.trip && (
          <div>
            <label htmlFor="tripDistance" className="label">
              Distance driven since last refuel
            </label>
            <input
              id="tripDistance"
              type="number"
              inputMode="decimal"
              className="input input-large"
              min="0"
              step="0.1"
              value={form.tripDistance}
              onChange={(event) =>
                setForm((current) => ({ ...current, tripDistance: event.target.value }))
              }
            />
          </div>
        )}

        <label className="checkbox-row" htmlFor="fullTank">
          <input
            id="fullTank"
            type="checkbox"
            checked={form.isFullTank}
            onChange={(event) =>
              setForm((current) => ({ ...current, isFullTank: event.target.checked }))
            }
          />
          <span>I filled the tank completely</span>
        </label>
        <p className="muted" style={{ marginTop: -4 }}>
          Fuel consumption is only calculated accurately when the tank is full.
        </p>

        {summary.errors.length > 0 && <p className="warning">{summary.errors[0]}</p>}
        {!summary.errors.length &&
          summary.warnings.map((message) => (
            <p className="warning" key={message}>
              {message}
            </p>
          ))}
      </section>

      <section className="card stack" style={{ marginTop: 12 }}>
        <h3 className="item-title" style={{ marginBottom: 0 }}>
          Pre-Save Summary
        </h3>
        <p className="item-row">
          Distance:{" "}
          {summary.distanceDriven !== null
            ? `${formatMetric(summary.distanceDriven, 1)} km`
            : "N/A"}
        </p>
        <p className="item-row">
          Consumption:{" "}
          {summary.calculatedConsumption !== null
            ? `${formatMetric(summary.calculatedConsumption, 1)} L/100km`
            : form.isFullTank
              ? "N/A"
              : "Partial refuel (not calculated)"}
        </p>
        <p className="item-row">
          Cost per km:{" "}
          {summary.costPerKm !== null
            ? `${formatMetric(summary.costPerKm, 3)}`
            : form.isFullTank && form.totalPrice.trim() !== ""
              ? "N/A"
              : "-"}
        </p>
        <p className="item-row">
          Cost per 100km:{" "}
          {summary.costPer100Km !== null
            ? `${formatMetric(summary.costPer100Km, 2)}`
            : form.isFullTank && form.totalPrice.trim() !== ""
              ? "N/A"
              : "-"}
        </p>
      </section>

      <section className="card stack" style={{ marginTop: 12 }}>
        <h3 className="item-title" style={{ marginBottom: 0 }}>
          Averages
        </h3>
        <p className="item-row">
          Average consumption (full-tank entries only):{" "}
          {averageConsumption === null
            ? "N/A"
            : `${formatMetric(averageConsumption, 2)} L/100km`}
        </p>
        {shouldShowPartialGuidance && (
          <p className="muted">
            For more accurate fuel consumption tracking, log refuels when the
            tank is full.
          </p>
        )}
      </section>

      <section className="list" style={{ marginTop: 12 }}>
        {sortedEntries.length === 0 && (
          <article className="card">
            <p className="muted">No refuel entries yet.</p>
          </article>
        )}
        {sortedEntries.map((entry) => (
          <article className="card" key={entry.id}>
            <h3 className="item-title">
              {entry.date}{" "}
              <span className="chip">
                {entry.isFullTank ? "Full Tank" : "Partial Refuel"}
              </span>
            </h3>
            <p className="item-row">
              Mode: {entry.distanceInputType === DISTANCE_MODE.odometer ? "Odometer" : "Trip"}
            </p>
            <p className="item-row">
              Distance:{" "}
              {entry.distanceDriven !== null
                ? `${formatMetric(entry.distanceDriven, 1)} km`
                : "N/A"}
            </p>
            <p className="item-row">
              Fuel: {entry.liters !== null ? `${formatMetric(entry.liters, 2)} L` : "N/A"}
            </p>
            <p className="item-row">
              Consumption:{" "}
              {entry.calculatedConsumption !== null
                ? `${formatMetric(entry.calculatedConsumption, 2)} L/100km`
                : "N/A"}
            </p>
            <p className="item-row">
              Cost per km:{" "}
              {entry.costPerKm !== null ? formatMetric(entry.costPerKm, 3) : "N/A"}
            </p>
          </article>
        ))}
      </section>

      {status && (
        <p className={status.toLowerCase().includes("saved") ? "muted" : "warning"}>
          {status}
        </p>
      )}

      <div className="sticky-cta">
        <button
          type="button"
          className="btn-primary"
          disabled={summary.errors.length > 0}
          onClick={saveRefuel}
        >
          Save Refuel
        </button>
      </div>
    </main>
  );
}

export default FuelEfficiency;
