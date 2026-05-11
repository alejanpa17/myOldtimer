import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbDelete, dbGet, dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import VehicleImageModal from "../components/VehicleImageModal";
import VehicleImageEmptyState from "../components/VehicleImageEmptyState";
import { parseNonNegativeMileage } from "../lib/mileage";
import {
  MAINTENANCE_STATUS,
  calculateCategoryState,
  normalizeCategories,
  todayIsoDate,
} from "../lib/maintenance";
import { DEFAULT_CHECKLIST, normalizeChecklistData } from "../lib/checklist";

function normalizeMaintenanceEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries.map((entry) => ({
    categoryIds: Array.isArray(entry?.categoryIds) ? entry.categoryIds : [],
    categories: Array.isArray(entry?.categories) ? entry.categories : [],
    date: entry?.date || "",
    kilometers: parseNonNegativeMileage(entry?.kilometers),
  }));
}

function dateRank(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? -1 : date.getTime();
}

function getLatestServiceByCategory(entries) {
  const map = new Map();

  entries.forEach((entry) => {
    entry.categoryIds.forEach((categoryId) => {
      const previous = map.get(categoryId);
      const nextDateRank = dateRank(entry.date);
      const previousDateRank = previous ? dateRank(previous.date) : -1;
      const shouldReplace =
        !previous ||
        nextDateRank > previousDateRank ||
        (nextDateRank === previousDateRank &&
          (entry.kilometers ?? -1) > (previous.kilometers ?? -1));

      if (shouldReplace) {
        map.set(categoryId, {
          date: entry.date,
          kilometers: entry.kilometers,
        });
      }
    });
  });

  return map;
}

function getMaintenanceSummary(categories, entries, currentMileage) {
  const latestServiceByCategory = getLatestServiceByCategory(entries);
  const now = todayIsoDate();
  const counts = {
    [MAINTENANCE_STATUS.ok]: 0,
    [MAINTENANCE_STATUS.dueSoon]: 0,
    [MAINTENANCE_STATUS.overdue]: 0,
    [MAINTENANCE_STATUS.unknown]: 0,
  };

  categories.forEach((category) => {
    const latestService = latestServiceByCategory.get(category.id);
    const categoryState = calculateCategoryState(
      {
        ...category,
        lastServiceDate: latestService?.date || category.lastServiceDate || "",
        lastServiceMileage:
          latestService?.kilometers ?? category.lastServiceMileage ?? null,
      },
      now,
      currentMileage
    );
    counts[categoryState.status] += 1;
  });

  return counts;
}

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(Number(value))) {
    return "N/A";
  }
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function Home() {
  const navigate = useNavigate();
  const [vehicleImage, setVehicleImage] = useState(null);
  const [vehicleInfo, setVehicleInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [maintenanceCategories, setMaintenanceCategories] = useState([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState([]);
  const [checklistSummary, setChecklistSummary] = useState({
    todo: 0,
    done: 0,
  });
  const [faultCount, setFaultCount] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentMileageInput, setCurrentMileageInput] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.vehicleImage, null),
      dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO),
      dbGet(STORAGE_KEYS.maintenanceCurrentMileage, ""),
      dbGet(STORAGE_KEYS.maintenanceCategories, []),
      dbGet(STORAGE_KEYS.maintenanceHistory, []),
      dbGet(STORAGE_KEYS.checklistData, DEFAULT_CHECKLIST),
      dbGet(STORAGE_KEYS.currentFaultCodes, []),
    ]).then(([
      storedImage,
      storedInfo,
      storedMileage,
      storedCategories,
      storedMaintenanceEntries,
      storedChecklist,
      storedFaultCodes,
    ]) => {
      if (!mounted) {
        return;
      }
      const normalizedChecklist = normalizeChecklistData(storedChecklist);
      setVehicleImage(storedImage);
      setVehicleInfo({
        ...DEFAULT_VEHICLE_INFO,
        ...(storedInfo || {}),
      });
      setCurrentMileageInput(storedMileage === "" ? "" : String(storedMileage));
      setMaintenanceCategories(normalizeCategories(storedCategories));
      setMaintenanceEntries(normalizeMaintenanceEntries(storedMaintenanceEntries));
      setChecklistSummary({
        todo: normalizedChecklist.todo.length,
        done: normalizedChecklist.done.length,
      });
      setFaultCount(Array.isArray(storedFaultCodes) ? storedFaultCodes.length : 0);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const vehicleLabel = useMemo(() => {
    const brand = vehicleInfo.brand?.trim();
    const model = vehicleInfo.model?.trim();
    if (brand || model) {
      return `${brand || "Vehicle"} ${model || ""}`.trim();
    }
    return "Vehicle";
  }, [vehicleInfo.brand, vehicleInfo.model]);

  const currentMileage = parseNonNegativeMileage(currentMileageInput);

  const maintenanceSummary = useMemo(
    () => getMaintenanceSummary(maintenanceCategories, maintenanceEntries, currentMileage),
    [currentMileage, maintenanceCategories, maintenanceEntries]
  );

  const vehicleMeta = useMemo(() => {
    return [
      vehicleInfo.modelYear,
      vehicleInfo.engine,
      vehicleInfo.gearbox,
    ]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" / ");
  }, [vehicleInfo.engine, vehicleInfo.gearbox, vehicleInfo.modelYear]);

  const maintenanceStatusLabel = useMemo(() => {
    if (maintenanceSummary.overdue > 0) {
      return `${maintenanceSummary.overdue} overdue`;
    }
    if (maintenanceSummary.dueSoon > 0) {
      return `${maintenanceSummary.dueSoon} due soon`;
    }
    if (maintenanceSummary.unknown > 0) {
      return `${maintenanceSummary.unknown} need setup`;
    }
    if (maintenanceSummary.ok > 0) {
      return "All tracked items OK";
    }
    return "No categories";
  }, [maintenanceSummary]);

  const garageHealth = useMemo(() => {
    if (faultCount > 0 || maintenanceSummary.overdue > 0) {
      return { label: "Needs attention", tone: "overdue" };
    }
    if (maintenanceSummary.dueSoon > 0 || checklistSummary.todo > 0) {
      return { label: "Open tasks", tone: "dueSoon" };
    }
    if (maintenanceSummary.ok > 0 || checklistSummary.done > 0) {
      return { label: "All good", tone: "ok" };
    }
    return { label: "Set up garage", tone: "unknown" };
  }, [
    checklistSummary.done,
    checklistSummary.todo,
    faultCount,
    maintenanceSummary.dueSoon,
    maintenanceSummary.ok,
    maintenanceSummary.overdue,
  ]);

  const actionCards = [
    {
      label: "Checklist",
      detail:
        checklistSummary.todo > 0
          ? `${checklistSummary.todo} open`
          : `${checklistSummary.done} done`,
      path: "/checklist",
      tone: "green",
    },
    {
      label: "Parts Finder",
      detail: vehicleInfo.vin?.trim() ? "Ready" : "Needs VIN",
      path: "/parts-finder",
      tone: "amber",
    },
    {
      label: "Fuel",
      detail: "Refuel logs",
      path: "/fuel-efficiency",
      tone: "green",
    },
  ];

  const saveImage = async (imageDataUrl) => {
    await dbSet(STORAGE_KEYS.vehicleImage, imageDataUrl);
    setVehicleImage(imageDataUrl);
  };

  const removeImage = async () => {
    await dbDelete(STORAGE_KEYS.vehicleImage);
    setVehicleImage(null);
  };

  return (
    <main className="page home-page">
      <section className="garage-hero">
        <div className="garage-hero-copy">
          <div className="hero-status-row">
            <p className="eyebrow">myOldtimer Garage</p>
            <span className={`garage-health-pill status-${garageHealth.tone}`}>
              {garageHealth.label}
            </span>
          </div>
          <h1 className="home-title">{vehicleLabel}</h1>
          {vehicleMeta && <p className="home-subtitle">{vehicleMeta}</p>}
        </div>
        <div className="garage-hero-media">
          {vehicleImage ? (
            <img
              src={vehicleImage}
              alt={`${vehicleLabel} profile`}
              className="vehicle-image vehicle-image-clickable"
              onClick={() => setShowImageModal(true)}
            />
          ) : (
            <VehicleImageEmptyState onAdd={() => setShowImageModal(true)} />
          )}
        </div>
      </section>

      <section className="home-command-strip" aria-label="Quick commands">
        <button type="button" onClick={() => navigate("/maintenance/history")}>
          Log service
        </button>
        <button type="button" onClick={() => navigate("/diagnostics/fault-codes")}>
          Scan codes
        </button>
        <button type="button" onClick={() => navigate("/ai")}>
          Ask AI
        </button>
      </section>

      <section className="home-status-grid" aria-label="Garage status">
        <article className="status-tile status-tile-large">
          <span className="status-kicker">Odometer</span>
          <strong>
            {currentMileage === null ? "Not set" : `${formatNumber(currentMileage)} km`}
          </strong>
        </article>

        <article className="status-tile">
          <span className="status-kicker">Maintenance</span>
          <strong>{maintenanceStatusLabel}</strong>
          <span className="status-note">{maintenanceSummary.ok} tracked OK</span>
        </article>
        <article className="status-tile">
          <span className="status-kicker">Checklist</span>
          <strong>{checklistSummary.todo} open</strong>
          <span className="status-note">{checklistSummary.done} completed</span>
        </article>
      </section>

      <section className="home-section-heading">
        <h2>Tools</h2>
      </section>

      <section className="quick-action-grid">
        {actionCards.map((action) => (
          <button
            key={action.path}
            type="button"
            className={`quick-action quick-action-${action.tone}`}
            onClick={() => navigate(action.path)}
          >
            <span className="quick-action-mark" aria-hidden="true" />
            <span className="quick-action-copy">
              <strong>{action.label}</strong>
              <small>{action.detail}</small>
            </span>
            <span className="quick-action-arrow" aria-hidden="true">
              &gt;
            </span>
          </button>
        ))}
      </section>

      <VehicleImageModal
        open={showImageModal}
        currentImage={vehicleImage}
        onClose={() => setShowImageModal(false)}
        onSave={saveImage}
        onRemove={removeImage}
      />
    </main>
  );
}

export default Home;
