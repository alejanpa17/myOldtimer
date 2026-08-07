import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet, dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import VehicleImageModal from "../components/VehicleImageModal";
import VehicleImageEmptyState from "../components/VehicleImageEmptyState";
import { parseNonNegativeMileage } from "../lib/mileage";
import {
  getSelectedVehicle,
  getVehicleLabel,
  loadGarage,
  saveVehicles,
} from "../lib/garage";
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

function DashboardIcon({ name }) {
  const paths = {
    odometer:
      "M4 17a8 8 0 1 1 16 0h-2a6 6 0 1 0-12 0H4Zm8-8a1 1 0 0 1 1 1v3.6l2.3 1.3-1 1.8-2.8-1.7a1 1 0 0 1-.5-.9V10a1 1 0 0 1 1-1Z",
    service:
      "M21.1 6.1a5.5 5.5 0 0 1-7.2 6.9l-7.6 7.6a2.1 2.1 0 0 1-3-3l7.6-7.6A5.5 5.5 0 0 1 17.8 2.8l-3.2 3.2 3.4 3.4 3.1-3.3Z",
    checklist:
      "M7.8 6.7 5.7 8.8 4.4 7.5 3.2 8.7l2.5 2.5L9 7.9 7.8 6.7Zm3.2.1h9v1.8h-9V6.8Zm-3.2 6.5-2.1 2.1-1.3-1.3-1.2 1.2 2.5 2.5L9 14.5l-1.2-1.2Zm3.2.1h9v1.8h-9v-1.8Z",
  };

  return (
    <span className="status-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path fill="currentColor" d={paths[name]} />
      </svg>
    </span>
  );
}

function Home() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
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
      loadGarage(),
      dbGet(STORAGE_KEYS.maintenanceCategories, []),
      dbGet(STORAGE_KEYS.maintenanceHistory, []),
      dbGet(STORAGE_KEYS.checklistData, DEFAULT_CHECKLIST),
    ]).then(([
      garage,
      storedCategories,
      storedMaintenanceEntries,
      storedChecklist,
    ]) => {
      if (!mounted) {
        return;
      }
      const normalizedChecklist = normalizeChecklistData(storedChecklist);
      setVehicles(garage.vehicles);
      setSelectedVehicleId(garage.selectedVehicleId);
      setVehicleImage(garage.selectedVehicle?.image || null);
      setVehicleInfo(garage.selectedVehicle?.info || DEFAULT_VEHICLE_INFO);
      setCurrentMileageInput(
        garage.selectedVehicle?.mileage === "" ? "" : String(garage.selectedVehicle?.mileage ?? "")
      );
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

  const vehicleLabel = useMemo(
    () => getVehicleLabel({ info: vehicleInfo }),
    [vehicleInfo]
  );

  const selectedVehicle = useMemo(
    () => getSelectedVehicle(vehicles, selectedVehicleId),
    [selectedVehicleId, vehicles]
  );

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

  const maintenanceTone = maintenanceSummary.overdue > 0
    ? "overdue"
    : maintenanceSummary.dueSoon > 0
      ? "dueSoon"
      : maintenanceSummary.unknown > 0
        ? "unknown"
        : "ok";

  const saveImage = async (imageDataUrl) => {
    await dbSet(STORAGE_KEYS.vehicleImage, imageDataUrl);
    setVehicleImage(imageDataUrl);
    if (selectedVehicle) {
      const now = new Date().toISOString();
      const nextVehicle = {
        ...selectedVehicle,
        image: imageDataUrl,
        updatedAt: now,
      };
      const nextVehicles = vehicles.map((vehicle) =>
        vehicle.id === nextVehicle.id ? nextVehicle : vehicle
      );
      setVehicles(nextVehicles);
      await saveVehicles(nextVehicles, nextVehicle.id);
    }
  };

  const removeImage = async () => {
    await dbSet(STORAGE_KEYS.vehicleImage, null);
    setVehicleImage(null);
    if (selectedVehicle) {
      const now = new Date().toISOString();
      const nextVehicle = {
        ...selectedVehicle,
        image: null,
        updatedAt: now,
      };
      const nextVehicles = vehicles.map((vehicle) =>
        vehicle.id === nextVehicle.id ? nextVehicle : vehicle
      );
      setVehicles(nextVehicles);
      await saveVehicles(nextVehicles, nextVehicle.id);
    }
  };

  return (
    <main className="page home-page">
      <section className="garage-hero">
        <div className="garage-hero-copy">
          <div className="hero-status-row">
            <div>
              <p className="eyebrow">myOldtimer Garage</p>
              <span className="local-data-badge">
                <span aria-hidden="true" /> Local &amp; private
              </span>
            </div>
            <div className="hero-status-actions">
              <button
                type="button"
                className="vehicle-profile-access"
                onClick={() => navigate("/garage")}
                aria-label="Open garage menu"
                title="Garage menu"
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
        <button
          type="button"
          className="status-tile status-tile-large status-tile-button"
          onClick={() => navigate("/vehicle")}
          aria-label="Open vehicle profile to update odometer"
        >
          <DashboardIcon name="odometer" />
          <span className="status-copy">
            <span className="status-kicker">Odometer</span>
            <strong>
              {currentMileage === null ? "Not set" : `${formatNumber(currentMileage)} km`}
            </strong>
            <span className="status-note">Tap to update vehicle details</span>
          </span>
          <span className="status-arrow" aria-hidden="true">&#8599;</span>
        </button>

        <button
          type="button"
          className={`status-tile status-tile-button status-tile-${maintenanceTone}`}
          onClick={() => navigate("/maintenance")}
        >
          <DashboardIcon name="service" />
          <span className="status-copy">
            <span className="status-kicker">Maintenance</span>
            <strong>{maintenanceStatusLabel}</strong>
            <span className="status-note">{maintenanceSummary.ok} tracked OK</span>
          </span>
        </button>
        <button
          type="button"
          className="status-tile status-tile-button"
          onClick={() => navigate("/checklist")}
        >
          <DashboardIcon name="checklist" />
          <span className="status-copy">
            <span className="status-kicker">Checklist</span>
            <strong>{checklistSummary.todo} open</strong>
            <span className="status-note">{checklistSummary.done} completed</span>
          </span>
        </button>
      </section>

      <section className="home-workshop" aria-labelledby="workshop-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Records &amp; tools</p>
            <h2 id="workshop-title">Workshop</h2>
          </div>
          <span className="section-count">{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}</span>
        </div>
        <div className="quick-action-grid">
          <button type="button" className="quick-action" onClick={() => navigate("/maintenance/history")}>
            <span className="quick-action-number">01</span>
            <span><strong>Service log</strong><small>Maintenance history</small></span>
            <span aria-hidden="true">&#8594;</span>
          </button>
          <button type="button" className="quick-action" onClick={() => navigate("/maintenance/replace")}>
            <span className="quick-action-number">02</span>
            <span><strong>Parts log</strong><small>Replacement history</small></span>
            <span aria-hidden="true">&#8594;</span>
          </button>
          <button type="button" className="quick-action" onClick={() => navigate("/diagnostics")}>
            <span className="quick-action-number">03</span>
            <span><strong>Diagnostics</strong><small>Simulation tools</small></span>
            <span aria-hidden="true">&#8594;</span>
          </button>
        </div>
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
