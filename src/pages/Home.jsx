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
    ]).then(([
      storedImage,
      storedInfo,
      storedMileage,
      storedCategories,
      storedMaintenanceEntries,
      storedChecklist,
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
            <div className="hero-status-actions">
              <button
                type="button"
                className="vehicle-profile-access"
                onClick={() => navigate("/vehicle")}
                aria-label="Open vehicle profile"
                title="Vehicle profile"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    fill="currentColor"
                    d="M5.3 10.2 7 6.4A2.4 2.4 0 0 1 9.2 5h5.6A2.4 2.4 0 0 1 17 6.4l1.7 3.8 1.1.4c.7.2 1.2.9 1.2 1.7V17a1 1 0 0 1-1 1h-1.2a2.3 2.3 0 0 1-4.4 0H9.6a2.3 2.3 0 0 1-4.4 0H4a1 1 0 0 1-1-1v-4.7c0-.8.5-1.5 1.2-1.7l1.1-.4Zm2.1-.4h9.2l-1-2.3a.9.9 0 0 0-.8-.5H9.2a.9.9 0 0 0-.8.5l-1 2.3Zm-.1 7.6a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm9.4 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
                  />
                </svg>
              </button>
            </div>
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

      <section className="home-status-grid" aria-label="Garage status">
        <article className="status-tile status-tile-large">
          <span className="status-kicker">Odometer</span>
          <strong>
            {currentMileage === null ? "Not set" : `${formatNumber(currentMileage)} km`}
          </strong>
        </article>

        <button
          type="button"
          className="status-tile status-tile-button"
          onClick={() => navigate("/maintenance")}
        >
          <span className="status-kicker">Maintenance</span>
          <strong>{maintenanceStatusLabel}</strong>
          <span className="status-note">{maintenanceSummary.ok} tracked OK</span>
        </button>
        <button
          type="button"
          className="status-tile status-tile-button"
          onClick={() => navigate("/checklist")}
        >
          <span className="status-kicker">Checklist</span>
          <strong>{checklistSummary.todo} open</strong>
          <span className="status-note">{checklistSummary.done} completed</span>
        </button>
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
