import { createId } from "./helpers";
import { DEFAULT_MAINTENANCE_CATEGORY_TEMPLATES } from "./constants";

export const MAINTENANCE_STATUS = {
  ok: "ok",
  dueSoon: "dueSoon",
  overdue: "overdue",
  unknown: "unknown",
};

export const MAINTENANCE_WARNING = {
  timeDays: 30,
  mileageRatio: 0.1,
};

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIsoDate() {
  return formatLocalDate(new Date());
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(dateString) {
  if (!dateString) {
    return null;
  }
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function daysBetween(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addMonthsToDate(dateString, months) {
  const date = parseDate(dateString);
  if (!date || !months || months <= 0) {
    return null;
  }
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return formatLocalDate(next);
}

function includesTime(category) {
  return category.intervalType === "time" || category.intervalType === "both";
}

function includesMileage(category) {
  return category.intervalType === "mileage" || category.intervalType === "both";
}

export function calculateCategoryState(
  category,
  currentDateString,
  currentMileage,
  warning = MAINTENANCE_WARNING
) {
  const nowDate = parseDate(currentDateString || todayIsoDate()) || new Date();
  const mileageNow = parseNumber(currentMileage);
  const progressValues = [];

  let nextDueDate = null;
  let nextDueMileage = null;
  let isOverdue = false;
  let isDueSoon = false;
  let hasUnknown = false;

  if (includesTime(category)) {
    const intervalMonths = parseNumber(category.intervalMonths);
    const lastServiceDate = parseDate(category.lastServiceDate);

    if (!intervalMonths || intervalMonths <= 0 || !lastServiceDate) {
      hasUnknown = true;
    } else {
      nextDueDate = addMonthsToDate(category.lastServiceDate, intervalMonths);
      const nextDueDateObj = parseDate(nextDueDate);

      if (nextDueDateObj) {
        const daysUntilDue = daysBetween(nowDate, nextDueDateObj);
        if (daysUntilDue < 0) {
          isOverdue = true;
        } else if (daysUntilDue <= warning.timeDays) {
          isDueSoon = true;
        }

        const totalIntervalDays = Math.max(
          1,
          daysBetween(lastServiceDate, nextDueDateObj)
        );
        const elapsedDays = Math.max(0, daysBetween(lastServiceDate, nowDate));
        progressValues.push(clamp((elapsedDays / totalIntervalDays) * 100, 0, 100));
      }
    }
  }

  if (includesMileage(category)) {
    const intervalKm = parseNumber(category.intervalKilometers);
    const lastServiceMileage = parseNumber(category.lastServiceMileage);

    if (!intervalKm || intervalKm <= 0 || lastServiceMileage === null) {
      hasUnknown = true;
    } else {
      nextDueMileage = lastServiceMileage + intervalKm;
      if (mileageNow === null) {
        hasUnknown = true;
      } else {
        if (mileageNow > nextDueMileage) {
          isOverdue = true;
        } else if (mileageNow >= nextDueMileage - intervalKm * warning.mileageRatio) {
          isDueSoon = true;
        }

        const consumed = mileageNow - lastServiceMileage;
        progressValues.push(clamp((consumed / intervalKm) * 100, 0, 100));
      }
    }
  }

  let status = MAINTENANCE_STATUS.ok;
  if (isOverdue) {
    status = MAINTENANCE_STATUS.overdue;
  } else if (isDueSoon) {
    status = MAINTENANCE_STATUS.dueSoon;
  } else if (hasUnknown) {
    status = MAINTENANCE_STATUS.unknown;
  }

  return {
    nextDueDate,
    nextDueMileage,
    status,
    progressPercentage: progressValues.length
      ? Math.round(Math.max(...progressValues))
      : null,
  };
}

export function normalizeCategory(rawCategory, index = 0) {
  const now = new Date().toISOString();
  const intervalType =
    rawCategory?.intervalType === "time" ||
    rawCategory?.intervalType === "mileage" ||
    rawCategory?.intervalType === "both"
      ? rawCategory.intervalType
      : "both";

  const lastServiceMileage = parseNumber(rawCategory?.lastServiceMileage);

  return {
    id: rawCategory?.id || `maintenance-category-${index}-${Date.now()}`,
    name: rawCategory?.name || `Category ${index + 1}`,
    intervalType,
    intervalMonths: parseNumber(rawCategory?.intervalMonths),
    intervalKilometers: parseNumber(rawCategory?.intervalKilometers),
    lastServiceDate: rawCategory?.lastServiceDate || "",
    lastServiceMileage,
    createdAt: rawCategory?.createdAt || now,
    updatedAt: rawCategory?.updatedAt || now,
  };
}

export function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) {
    return [];
  }
  return rawCategories.map((category, index) => normalizeCategory(category, index));
}

export function normalizeServiceLogs(rawLogs) {
  if (!Array.isArray(rawLogs)) {
    return [];
  }
  return rawLogs.map((log, index) => ({
    id: log?.id || `maintenance-log-${index}-${Date.now()}`,
    categoryId: log?.categoryId || "",
    categoryName: log?.categoryName || "Unknown",
    serviceDate: log?.serviceDate || "",
    serviceMileage: parseNumber(log?.serviceMileage),
    comment: log?.comment || "",
    createdAt: log?.createdAt || new Date().toISOString(),
  }));
}

export function createDefaultMaintenanceCategories() {
  const now = new Date().toISOString();
  return DEFAULT_MAINTENANCE_CATEGORY_TEMPLATES.map((template) => ({
    id: createId("maintenance-category"),
    name: template.name,
    intervalType: template.intervalType,
    intervalMonths: template.intervalMonths ?? null,
    intervalKilometers: template.intervalKilometers ?? null,
    lastServiceDate: "",
    lastServiceMileage: null,
    createdAt: now,
    updatedAt: now,
  }));
}

export function statusWeight(status) {
  switch (status) {
    case MAINTENANCE_STATUS.overdue:
      return 4;
    case MAINTENANCE_STATUS.dueSoon:
      return 3;
    case MAINTENANCE_STATUS.unknown:
      return 2;
    default:
      return 1;
  }
}
