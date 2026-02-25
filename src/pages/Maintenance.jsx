import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import SaveCancelModal from "../components/SaveCancelModal";
import EditToggleButton from "../components/EditToggleButton";
import { parseNonNegativeMileage } from "../lib/mileage";
import {
  MAINTENANCE_STATUS,
  calculateCategoryState,
  createDefaultMaintenanceCategories,
  normalizeCategories,
  statusWeight,
  todayIsoDate,
} from "../lib/maintenance";
import { createId } from "../lib/helpers";

function parsePositiveNumber(value) {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value) {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeMaintenanceEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return [];
  }
  return rawEntries.map((entry) => ({
    id: entry?.id || `maintenance-entry-${Date.now()}`,
    categoryIds: Array.isArray(entry?.categoryIds) ? entry.categoryIds : [],
    categories: Array.isArray(entry?.categories)
      ? entry.categories.filter(Boolean)
      : typeof entry?.category === "string" && entry.category.trim()
        ? [entry.category.trim()]
        : [],
    date: entry?.date || "",
    kilometers: parseNonNegativeNumber(entry?.kilometers),
    comment: entry?.comment || "",
  }));
}

function emptyCategoryForm() {
  return {
    id: null,
    name: "",
    intervalType: "both",
    intervalMonths: "",
    intervalKilometers: "",
  };
}

function statusLabel(status) {
  switch (status) {
    case MAINTENANCE_STATUS.overdue:
      return "Overdue";
    case MAINTENANCE_STATUS.dueSoon:
      return "Due Soon";
    case MAINTENANCE_STATUS.unknown:
      return "Needs Setup";
    default:
      return "OK";
  }
}

function dateRank(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return -1;
  }
  return date.getTime();
}

function Maintenance() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState([]);
  const [currentMileage, setCurrentMileage] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm());
  const [categoryError, setCategoryError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.maintenanceCategories, []),
      dbGet(STORAGE_KEYS.maintenanceHistory, []),
      dbGet(STORAGE_KEYS.maintenanceCurrentMileage, ""),
    ]).then(([storedCategories, storedEntries, storedMileage]) => {
      if (!mounted) {
        return;
      }

      const normalizedCategories = normalizeCategories(storedCategories);
      const categoryById = new Map(
        normalizedCategories.map((category) => [category.id, category])
      );
      const categoryIdByName = new Map(
        normalizedCategories.map((category) => [
          category.name.trim().toLowerCase(),
          category.id,
        ])
      );
      const normalizedEntries = normalizeMaintenanceEntries(storedEntries).map((entry) => {
        let categoryIds = entry.categoryIds.filter((id) => categoryById.has(id));
        if (categoryIds.length === 0) {
          categoryIds = entry.categories
            .map((name) => categoryIdByName.get(name.trim().toLowerCase()))
            .filter(Boolean);
        }
        return {
          ...entry,
          categoryIds,
          categories: categoryIds
            .map((id) => categoryById.get(id)?.name)
            .filter(Boolean),
        };
      });

      if (normalizedCategories.length === 0) {
        const defaults = createDefaultMaintenanceCategories();
        setCategories(defaults);
        dbSet(STORAGE_KEYS.maintenanceCategories, defaults);
      } else {
        setCategories(normalizedCategories);
        if (JSON.stringify(normalizedCategories) !== JSON.stringify(storedCategories)) {
          dbSet(STORAGE_KEYS.maintenanceCategories, normalizedCategories);
        }
      }

      setMaintenanceEntries(normalizedEntries);
      if (JSON.stringify(normalizedEntries) !== JSON.stringify(storedEntries)) {
        dbSet(STORAGE_KEYS.maintenanceHistory, normalizedEntries);
      }
      setCurrentMileage(parseNonNegativeMileage(storedMileage));
    });

    return () => {
      mounted = false;
    };
  }, []);

  const latestServiceByCategory = useMemo(() => {
    const map = new Map();

    maintenanceEntries.forEach((entry) => {
      entry.categoryIds.forEach((key) => {
        const previous = map.get(key);
        const nextDateRank = dateRank(entry.date);
        const previousDateRank = previous ? dateRank(previous.date) : -1;

        const shouldReplace =
          !previous ||
          nextDateRank > previousDateRank ||
          (nextDateRank === previousDateRank &&
            (entry.kilometers ?? -1) > (previous.kilometers ?? -1));

        if (shouldReplace) {
          map.set(key, {
            date: entry.date,
            kilometers: entry.kilometers,
          });
        }
      });
    });

    return map;
  }, [maintenanceEntries]);

  const categoriesWithState = useMemo(() => {
    const now = todayIsoDate();
    return categories
      .map((category) => {
        const fromList = latestServiceByCategory.get(category.id);
        const effectiveLastServiceDate =
          fromList?.date || category.lastServiceDate || "";
        const effectiveLastServiceMileage =
          fromList?.kilometers ?? category.lastServiceMileage ?? null;

        const runtimeCategory = {
          ...category,
          lastServiceDate: effectiveLastServiceDate,
          lastServiceMileage: effectiveLastServiceMileage,
        };

        return {
          ...category,
          lastServiceDateCalculated: effectiveLastServiceDate,
          lastServiceMileageCalculated: effectiveLastServiceMileage,
          ...calculateCategoryState(runtimeCategory, now, currentMileage),
        };
      })
      .sort((a, b) => {
        const weightDiff = statusWeight(b.status) - statusWeight(a.status);
        if (weightDiff !== 0) {
          return weightDiff;
        }
        return a.name.localeCompare(b.name);
      });
  }, [categories, currentMileage, latestServiceByCategory]);

  const statusSummary = useMemo(() => {
    return categoriesWithState.reduce(
      (acc, category) => {
        acc[category.status] += 1;
        return acc;
      },
      { ok: 0, dueSoon: 0, overdue: 0, unknown: 0 }
    );
  }, [categoriesWithState]);

  const persistCategories = async (nextCategories) => {
    setCategories(nextCategories);
    await dbSet(STORAGE_KEYS.maintenanceCategories, nextCategories);
  };

  const syncHistoryWithCategories = async (nextCategories, sourceEntries) => {
    const categoryById = new Map(nextCategories.map((category) => [category.id, category]));
    const syncedEntries = sourceEntries.map((entry) => {
      const categoryIds = (entry.categoryIds || []).filter((id) => categoryById.has(id));
      return {
        ...entry,
        categoryIds,
        categories: categoryIds
          .map((id) => categoryById.get(id)?.name)
          .filter(Boolean),
      };
    });

    setMaintenanceEntries(syncedEntries);
    await dbSet(STORAGE_KEYS.maintenanceHistory, syncedEntries);
  };

  const openAddCategory = () => {
    setCategoryForm(emptyCategoryForm());
    setCategoryError("");
    setShowCategoryModal(true);
  };

  const openEditCategory = (category) => {
    setCategoryForm({
      id: category.id,
      name: category.name,
      intervalType: category.intervalType,
      intervalMonths:
        category.intervalMonths === null || category.intervalMonths === undefined
          ? ""
          : String(category.intervalMonths),
      intervalKilometers:
        category.intervalKilometers === null ||
        category.intervalKilometers === undefined
          ? ""
          : String(category.intervalKilometers),
    });
    setCategoryError("");
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setCategoryForm(emptyCategoryForm());
    setCategoryError("");
  };

  const validateCategoryForm = () => {
    const name = categoryForm.name.trim();
    if (!name) {
      return "Category name is required.";
    }

    const requiresTime =
      categoryForm.intervalType === "time" || categoryForm.intervalType === "both";
    const requiresMileage =
      categoryForm.intervalType === "mileage" || categoryForm.intervalType === "both";

    const intervalMonths = requiresTime
      ? parsePositiveNumber(categoryForm.intervalMonths)
      : null;
    const intervalKilometers = requiresMileage
      ? parsePositiveNumber(categoryForm.intervalKilometers)
      : null;

    if (requiresTime && intervalMonths === null) {
      return "Interval months must be greater than 0.";
    }
    if (requiresMileage && intervalKilometers === null) {
      return "Interval kilometers must be greater than 0.";
    }
    return "";
  };

  const saveCategory = async () => {
    const validationError = validateCategoryForm();
    if (validationError) {
      setCategoryError(validationError);
      return;
    }

    const requiresTime =
      categoryForm.intervalType === "time" || categoryForm.intervalType === "both";
    const requiresMileage =
      categoryForm.intervalType === "mileage" || categoryForm.intervalType === "both";

    const existing = categories.find((item) => item.id === categoryForm.id);
    const now = new Date().toISOString();

    const nextCategory = {
      id: categoryForm.id || createId("maintenance-category"),
      name: categoryForm.name.trim(),
      intervalType: categoryForm.intervalType,
      intervalMonths: requiresTime ? Number(categoryForm.intervalMonths) : null,
      intervalKilometers: requiresMileage
        ? Number(categoryForm.intervalKilometers)
        : null,
      lastServiceDate: existing?.lastServiceDate || "",
      lastServiceMileage: existing?.lastServiceMileage ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const nextCategories = categoryForm.id
      ? categories.map((item) => (item.id === categoryForm.id ? nextCategory : item))
      : [...categories, nextCategory];

    await persistCategories(nextCategories);
    await syncHistoryWithCategories(nextCategories, maintenanceEntries);
    closeCategoryModal();
    setStatusMessage("Category saved.");
  };

  const toggleManageMode = () => {
    setManageMode((current) => !current);
    setSelectedIds([]);
  };

  const toggleSelection = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const nextCategories = categories.filter((item) => !selectedIds.includes(item.id));
    await persistCategories(nextCategories);
    await syncHistoryWithCategories(nextCategories, maintenanceEntries);
    setSelectedIds([]);
    setManageMode(false);
    setShowDeleteConfirm(false);
    setStatusMessage("Selected categories deleted.");
  };

  return (
    <main className="page page-with-sticky-cta">
      <h2 className="page-title">Maintenance Overview</h2>

      <section className="card field-grid">
        <h3 className="item-title" style={{ marginBottom: 0 }}>
          Vehicle Mileage
        </h3>
        <p className="item-row">
          {typeof currentMileage === "number"
            ? `${Math.round(currentMileage)} km`
            : "Not set yet (set it on Home screen)."}
        </p>
        <div className="maintenance-status-summary">
          <span className="chip status-chip status-ok">OK: {statusSummary.ok}</span>
          <span className="chip status-chip status-dueSoon">
            Due Soon: {statusSummary.dueSoon}
          </span>
          <span className="chip status-chip status-overdue">
            Overdue: {statusSummary.overdue}
          </span>
          <span className="chip status-chip status-unknown">
            Needs Setup: {statusSummary.unknown}
          </span>
        </div>
      </section>

      <section className="list" style={{ marginTop: 12 }}>
        {categoriesWithState.length === 0 && (
          <article className="card">
            <p className="muted">No maintenance categories yet.</p>
          </article>
        )}
        {categoriesWithState.map((category) => (
          <div
            className={`maintenance-entry-row ${
              manageMode ? "maintenance-entry-row-manage" : ""
            }`}
            key={category.id}
          >
            <article className="card maintenance-entry-card">
              <div className="maintenance-card-header">
                <h3 className="item-title">{category.name}</h3>
                <span className={`status-badge status-${category.status}`}>
                  {statusLabel(category.status)}
                </span>
              </div>
              {(category.intervalType === "time" ||
                category.intervalType === "both") && (
                <>
                  <p className="item-row">
                    Last service date: {category.lastServiceDateCalculated || "N/A"}
                  </p>
                  <p className="item-row">
                    Next due date: {category.nextDueDate || "N/A"}
                  </p>
                </>
              )}
              {(category.intervalType === "mileage" ||
                category.intervalType === "both") && (
                <>
                  <p className="item-row">
                    Last service mileage:{" "}
                    {typeof category.lastServiceMileageCalculated === "number"
                      ? `${Math.round(category.lastServiceMileageCalculated)} km`
                      : "N/A"}
                  </p>
                  <p className="item-row">
                    Next due mileage:{" "}
                    {typeof category.nextDueMileage === "number"
                      ? `${Math.round(category.nextDueMileage)} km`
                      : "N/A"}
                  </p>
                </>
              )}
              {typeof category.progressPercentage === "number" && (
                <div className="maintenance-progress">
                  <div
                    className={`maintenance-progress-fill status-${category.status}`}
                    style={{ width: `${Math.max(2, category.progressPercentage)}%` }}
                  />
                </div>
              )}
            </article>
            <div className="maintenance-side-controls" aria-hidden={!manageMode}>
              <label className="maintenance-side-check">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(category.id)}
                  onChange={() => toggleSelection(category.id)}
                  aria-label={`Select ${category.name}`}
                  tabIndex={manageMode ? 0 : -1}
                />
              </label>
              <button
                type="button"
                className="maintenance-gear-button"
                onClick={() => openEditCategory(category)}
                aria-label={`Configure ${category.name}`}
                title={`Configure ${category.name}`}
                tabIndex={manageMode ? 0 : -1}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    fill="currentColor"
                    d="M19.4 13.5a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.2a.5.5 0 0 0-.6-.2l-2.4 1a7.3 7.3 0 0 0-2.6-1.5l-.4-2.6a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-2.6 1.5l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.3a.5.5 0 0 0 .1.6l2 1.6a7.8 7.8 0 0 0-.1 1.5 7.8 7.8 0 0 0 .1 1.5l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.2c.1.2.4.3.6.2l2.4-1a7.3 7.3 0 0 0 2.6 1.5l.4 2.6c0 .2.2.4.5.4h3.8c.3 0 .5-.2.5-.4l.4-2.6a7.3 7.3 0 0 0 2.6-1.5l2.4 1c.2.1.5 0 .6-.2l1.9-3.2a.5.5 0 0 0-.1-.6l-2-1.6ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </section>

      {manageMode && (
        <section style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-danger"
            disabled={selectedIds.length === 0}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Selected
          </button>
        </section>
      )}

      <section className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" onClick={() => navigate("/maintenance/replace")}>
          Replace History
        </button>
        <button type="button" onClick={() => navigate("/maintenance/history")}>
          Maintenance List
        </button>
      </section>

      {statusMessage && <p className="muted">{statusMessage}</p>}

      {!manageMode && (
        <button
          type="button"
          className="fab"
          onClick={openAddCategory}
          aria-label="Add maintenance category"
        >
          +
        </button>
      )}

      <EditToggleButton
        active={manageMode}
        onClick={toggleManageMode}
        label="Manage"
        className="fab fab-left"
      />

      <SaveCancelModal
        open={showCategoryModal}
        title={categoryForm.id ? "Edit Category" : "Add Category"}
        onSave={saveCategory}
        onCancel={closeCategoryModal}
      >
        <section className="field-grid">
          <div>
            <label className="label" htmlFor="category-name">
              Category Name
            </label>
            <input
              id="category-name"
              className="input"
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="interval-type">
              Interval Type
            </label>
            <select
              id="interval-type"
              className="select"
              value={categoryForm.intervalType}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  intervalType: event.target.value,
                }))
              }
            >
              <option value="time">Time</option>
              <option value="mileage">Mileage</option>
              <option value="both">Both</option>
            </select>
          </div>
          {(categoryForm.intervalType === "time" ||
            categoryForm.intervalType === "both") && (
            <div>
              <label className="label" htmlFor="interval-months">
                Interval (months)
              </label>
              <input
                id="interval-months"
                className="input"
                inputMode="numeric"
                value={categoryForm.intervalMonths}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    intervalMonths: event.target.value,
                  }))
                }
              />
            </div>
          )}
          {(categoryForm.intervalType === "mileage" ||
            categoryForm.intervalType === "both") && (
            <div>
              <label className="label" htmlFor="interval-km">
                Interval (kilometers)
              </label>
              <input
                id="interval-km"
                className="input"
                inputMode="numeric"
                value={categoryForm.intervalKilometers}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    intervalKilometers: event.target.value,
                  }))
                }
              />
            </div>
          )}
          {categoryError && <p className="warning">{categoryError}</p>}
        </section>
      </SaveCancelModal>

      <SaveCancelModal
        open={showDeleteConfirm}
        title="Delete Categories"
        saveLabel="Delete"
        onSave={deleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
      >
        <p className="muted" style={{ margin: 0 }}>
          Delete {selectedIds.length} selected categor
          {selectedIds.length === 1 ? "y" : "ies"}?
        </p>
      </SaveCancelModal>
    </main>
  );
}

export default Maintenance;
