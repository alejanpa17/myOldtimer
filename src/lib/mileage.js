import { STORAGE_KEYS } from "./constants";
import { dbGet, dbSet } from "./db";

export function parseNonNegativeMileage(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function getStoredMileage() {
  const stored = await dbGet(STORAGE_KEYS.maintenanceCurrentMileage, "");
  return parseNonNegativeMileage(stored);
}

export async function syncMileageIfHigher(candidateValue) {
  const candidateMileage = parseNonNegativeMileage(candidateValue);
  if (candidateMileage === null) {
    return false;
  }

  const currentMileage = await getStoredMileage();
  if (currentMileage === null || candidateMileage > currentMileage) {
    await dbSet(STORAGE_KEYS.maintenanceCurrentMileage, candidateMileage);
    return true;
  }

  return false;
}
