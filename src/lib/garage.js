import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "./constants";
import { dbGet, dbSet } from "./db";
import { createId } from "./helpers";
import { DEFAULT_CHECKLIST } from "./checklist";
import { parseNonNegativeMileage } from "./mileage";

const VEHICLE_DATA_DEFAULTS = {
  diagnosticsConnected: false,
  currentFaultCodes: [],
  faultHistory: [],
  replaceHistory: [],
  maintenanceHistory: [],
  maintenanceCategories: [],
  maintenanceServiceLogs: [],
  checklistData: DEFAULT_CHECKLIST,
  fuelEfficiencyEntries: [],
  fuelEfficiencyMode: "odometer",
  aiChatLog: [],
  aiManualUrls: [],
};

const VEHICLE_DATA_STORAGE_KEYS = Object.entries(VEHICLE_DATA_DEFAULTS).map(
  ([name, fallback]) => ({
    name,
    key: STORAGE_KEYS[name],
    fallback,
  })
);

export function normalizeVehicleInfo(info) {
  return {
    ...DEFAULT_VEHICLE_INFO,
    ...(info || {}),
  };
}

export function isVehicleInfoEmpty(info) {
  const normalized = normalizeVehicleInfo(info);
  return Object.entries(normalized).every(([key, value]) => {
    if (key === "drive" || key === "steering") {
      return true;
    }
    return !String(value || "").trim();
  });
}

export function getVehicleLabel(vehicle) {
  const info = normalizeVehicleInfo(vehicle?.info);
  const brand = info.brand?.trim();
  const model = info.model?.trim();
  if (brand || model) {
    return `${brand || "Vehicle"} ${model || ""}`.trim();
  }
  return "Vehicle";
}

export function createVehicleRecord({
  id = createId("vehicle"),
  info = DEFAULT_VEHICLE_INFO,
  image = null,
  mileage = "",
  data = {},
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
} = {}) {
  const parsedMileage = parseNonNegativeMileage(mileage);
  return {
    id,
    info: normalizeVehicleInfo(info),
    image: image || null,
    mileage: parsedMileage === null ? "" : parsedMileage,
    data: {
      ...VEHICLE_DATA_DEFAULTS,
      ...(data || {}),
    },
    createdAt,
    updatedAt,
  };
}

export function normalizeVehicles(rawVehicles) {
  if (!Array.isArray(rawVehicles)) {
    return [];
  }

  return rawVehicles
    .map((vehicle) =>
      createVehicleRecord({
        id: vehicle?.id || createId("vehicle"),
        info: vehicle?.info,
        image: vehicle?.image || null,
        mileage: vehicle?.mileage ?? "",
        data: vehicle?.data,
        createdAt: vehicle?.createdAt,
        updatedAt: vehicle?.updatedAt,
      })
    )
    .filter((vehicle) => vehicle.id);
}

export function getSelectedVehicle(vehicles, selectedVehicleId) {
  return (
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ||
    vehicles[0] ||
    null
  );
}

export async function syncCurrentVehicle(vehicle) {
  if (!vehicle) {
    return;
  }

  await Promise.all([
    dbSet(STORAGE_KEYS.vehicleInfo, normalizeVehicleInfo(vehicle.info)),
    dbSet(STORAGE_KEYS.vehicleImage, vehicle.image || null),
    dbSet(STORAGE_KEYS.maintenanceCurrentMileage, vehicle.mileage ?? ""),
    dbSet(STORAGE_KEYS.selectedVehicleId, vehicle.id),
    ...VEHICLE_DATA_STORAGE_KEYS.map(({ name, key, fallback }) =>
      dbSet(key, vehicle.data?.[name] ?? fallback)
    ),
  ]);
}

export async function captureActiveVehicleState(vehicle) {
  if (!vehicle) {
    return null;
  }

  const [info, image, mileage, ...dataValues] = await Promise.all([
    dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO),
    dbGet(STORAGE_KEYS.vehicleImage, null),
    dbGet(STORAGE_KEYS.maintenanceCurrentMileage, ""),
    ...VEHICLE_DATA_STORAGE_KEYS.map(({ key, fallback }) => dbGet(key, fallback)),
  ]);

  const data = VEHICLE_DATA_STORAGE_KEYS.reduce((acc, { name, fallback }, index) => {
    acc[name] = dataValues[index] ?? fallback;
    return acc;
  }, {});

  return createVehicleRecord({
    ...vehicle,
    info,
    image,
    mileage,
    data,
    updatedAt: new Date().toISOString(),
  });
}

export async function persistActiveVehicleSnapshot(vehicles, selectedVehicleId) {
  const selectedVehicle = getSelectedVehicle(vehicles, selectedVehicleId);
  if (!selectedVehicle) {
    return vehicles;
  }

  const snapshot = await captureActiveVehicleState(selectedVehicle);
  if (!snapshot) {
    return vehicles;
  }

  const nextVehicles = vehicles.map((vehicle) =>
    vehicle.id === snapshot.id ? snapshot : vehicle
  );
  await dbSet(STORAGE_KEYS.vehicles, nextVehicles);
  return nextVehicles;
}

export async function loadGarage() {
  const [storedVehicles, selectedVehicleId, legacyInfo, legacyImage, legacyMileage] =
    await Promise.all([
      dbGet(STORAGE_KEYS.vehicles, []),
      dbGet(STORAGE_KEYS.selectedVehicleId, ""),
      dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO),
      dbGet(STORAGE_KEYS.vehicleImage, null),
      dbGet(STORAGE_KEYS.maintenanceCurrentMileage, ""),
    ]);

  let vehicles = normalizeVehicles(storedVehicles);
  let selectedId = selectedVehicleId;

  if (vehicles.length === 0) {
    const hasLegacyVehicle =
      !isVehicleInfoEmpty(legacyInfo) ||
      Boolean(legacyImage) ||
      parseNonNegativeMileage(legacyMileage) !== null;

    if (hasLegacyVehicle) {
      const firstVehicle = createVehicleRecord({
        info: legacyInfo,
        image: legacyImage,
        mileage: legacyMileage,
        data: await readActiveVehicleData(),
      });
      vehicles = [firstVehicle];
      selectedId = firstVehicle.id;
      await dbSet(STORAGE_KEYS.vehicles, vehicles);
    }
  } else {
    vehicles = await persistActiveVehicleSnapshot(vehicles, selectedId);
  }

  const selectedVehicle = getSelectedVehicle(vehicles, selectedId);
  if (selectedVehicle) {
    selectedId = selectedVehicle.id;
    await syncCurrentVehicle(selectedVehicle);
  }

  return {
    vehicles,
    selectedVehicleId: selectedId,
    selectedVehicle,
  };
}

async function readActiveVehicleData() {
  const values = await Promise.all(
    VEHICLE_DATA_STORAGE_KEYS.map(({ key, fallback }) => dbGet(key, fallback))
  );

  return VEHICLE_DATA_STORAGE_KEYS.reduce((acc, { name, fallback }, index) => {
    acc[name] = values[index] ?? fallback;
    return acc;
  }, {});
}

export async function switchSelectedVehicle(vehicles, currentVehicleId, nextVehicleId) {
  const normalizedVehicles = await persistActiveVehicleSnapshot(
    normalizeVehicles(vehicles),
    currentVehicleId
  );
  const nextVehicle = getSelectedVehicle(normalizedVehicles, nextVehicleId);
  if (!nextVehicle) {
    return {
      vehicles: normalizedVehicles,
      selectedVehicleId: currentVehicleId,
      selectedVehicle: getSelectedVehicle(normalizedVehicles, currentVehicleId),
    };
  }

  await syncCurrentVehicle(nextVehicle);
  return {
    vehicles: normalizedVehicles,
    selectedVehicleId: nextVehicle.id,
    selectedVehicle: nextVehicle,
  };
}

export async function saveVehicles(vehicles, selectedVehicleId) {
  const normalizedVehicles = normalizeVehicles(vehicles);
  await Promise.all([
    dbSet(STORAGE_KEYS.vehicles, normalizedVehicles),
    dbSet(STORAGE_KEYS.selectedVehicleId, selectedVehicleId || ""),
  ]);
  return normalizedVehicles;
}
