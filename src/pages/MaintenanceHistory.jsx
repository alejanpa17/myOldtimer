import { useEffect, useMemo, useState } from "react";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import MaintenanceEntryModal from "../components/MaintenanceEntryModal";
import EditToggleButton from "../components/EditToggleButton";
import { normalizeCategories, todayIsoDate } from "../lib/maintenance";
import { syncMileageIfHigher } from "../lib/mileage";

function normalizeMaintenanceEntries(rawEntries, categories) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoryIdByName = new Map(
    categories.map((category) => [category.name.trim().toLowerCase(), category.id])
  );

  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries.map((entry, index) => {
    let categoryIds = Array.isArray(entry?.categoryIds)
      ? entry.categoryIds.filter((id) => categoryById.has(id))
      : [];

    if (categoryIds.length === 0) {
      const legacyNames = Array.isArray(entry?.categories)
        ? entry.categories
        : typeof entry?.category === "string" && entry.category.trim()
          ? [entry.category.trim()]
          : [];
      categoryIds = legacyNames
        .map((name) => categoryIdByName.get(name.trim().toLowerCase()))
        .filter(Boolean);
    }

    const categoriesSnapshot = categoryIds
      .map((id) => categoryById.get(id)?.name)
      .filter(Boolean);

    return {
      id: entry?.id || `maintenance-${index}-${Date.now()}`,
      categoryIds,
      categories: categoriesSnapshot,
      date: entry?.date || "",
      kilometers: entry?.kilometers || "",
      comment: entry?.comment || "",
    };
  });
}

function createEmptyForm() {
  return {
    id: null,
    categoryIds: [],
    date: todayIsoDate(),
    kilometers: "",
    comment: "",
  };
}

function MaintenanceHistory() {
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTitle, setEditorTitle] = useState("Add Maintenance Entry");
  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.maintenanceCategories, []),
      dbGet(STORAGE_KEYS.maintenanceHistory, []),
    ]).then(([storedCategories, storedEntries]) => {
      if (!mounted) {
        return;
      }

      const normalizedCategories = normalizeCategories(storedCategories);
      const normalizedEntries = normalizeMaintenanceEntries(
        storedEntries,
        normalizedCategories
      );

      setCategories(normalizedCategories);
      setEntries(normalizedEntries);

      if (JSON.stringify(normalizedEntries) !== JSON.stringify(storedEntries)) {
        dbSet(STORAGE_KEYS.maintenanceHistory, normalizedEntries);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [entries]);

  const saveEntries = async (nextEntries) => {
    setEntries(nextEntries);
    await dbSet(STORAGE_KEYS.maintenanceHistory, nextEntries);
  };

  const toggleSelect = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const nextEntries = entries.filter((entry) => !selectedIds.includes(entry.id));
    await saveEntries(nextEntries);
    setSelectedIds([]);
    setSelectMode(false);
  };

  const openAddEditor = () => {
    setEditorTitle("Add Maintenance Entry");
    setForm(createEmptyForm());
    setFormError("");
    setShowEditor(true);
  };

  const openEditEditor = (entry) => {
    setEditorTitle("Edit Maintenance Entry");
    setForm({
      id: entry.id,
      categoryIds: entry.categoryIds || [],
      date: entry.date || todayIsoDate(),
      kilometers: entry.kilometers || "",
      comment: entry.comment || "",
    });
    setFormError("");
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setForm(createEmptyForm());
    setFormError("");
  };

  const toggleCategory = (categoryId) => {
    setForm((current) => {
      const isSelected = current.categoryIds.includes(categoryId);
      return {
        ...current,
        categoryIds: isSelected
          ? current.categoryIds.filter((value) => value !== categoryId)
          : [...current.categoryIds, categoryId],
      };
    });
  };

  const saveEditor = async () => {
    if (form.categoryIds.length === 0) {
      setFormError("Select at least one category.");
      return;
    }

    const categoriesSnapshot = form.categoryIds
      .map((id) => categoryById.get(id)?.name)
      .filter(Boolean);

    const record = {
      id: form.id || createId("history"),
      categoryIds: form.categoryIds,
      categories: categoriesSnapshot,
      date: form.date,
      kilometers: form.kilometers,
      comment: form.comment,
    };

    const nextEntries = form.id
      ? entries.map((entry) => (entry.id === form.id ? record : entry))
      : [...entries, record];

    await saveEntries(nextEntries);
    await syncMileageIfHigher(record.kilometers);
    closeEditor();
  };

  return (
    <main className="page">
      <h2 className="page-title">Maintenance History</h2>

      <section className="list">
        {sortedEntries.length === 0 && (
          <article className="card">
            <p className="muted">No entries yet.</p>
          </article>
        )}
        {sortedEntries.map((entry) => {
          const names = (entry.categoryIds || [])
            .map((id) => categoryById.get(id)?.name)
            .filter(Boolean);
          return (
            <div
              key={entry.id}
              className={`maintenance-entry-row ${
                selectMode ? "maintenance-entry-row-manage" : ""
              }`}
            >
              <article className="card maintenance-entry-card">
                <h3 className="item-title">
                  {names.join(", ") || "No linked category"}
                </h3>
                <p className="item-row">Date: {entry.date || "N/A"}</p>
                <p className="item-row">Kilometers: {entry.kilometers || "N/A"}</p>
                <p className="item-row">Comment: {entry.comment || "N/A"}</p>
              </article>
              <div className="maintenance-side-controls" aria-hidden={!selectMode}>
                <label className="maintenance-side-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => toggleSelect(entry.id)}
                    aria-label={`Select maintenance entry ${entry.date || entry.id}`}
                    tabIndex={selectMode ? 0 : -1}
                  />
                </label>
                <button
                  type="button"
                  className="maintenance-gear-button"
                  onClick={() => openEditEditor(entry)}
                  aria-label={`Configure maintenance entry ${entry.date || entry.id}`}
                  title="Configure entry"
                  tabIndex={selectMode ? 0 : -1}
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
          );
        })}
      </section>

      {selectMode && (
        <button
          type="button"
          className="btn-danger"
          style={{ marginTop: 12 }}
          onClick={deleteSelected}
        >
          Delete Selected
        </button>
      )}

      <button
        type="button"
        className="fab"
        onClick={openAddEditor}
        aria-label="Add entry"
      >
        +
      </button>

      <EditToggleButton
        active={selectMode}
        onClick={() => {
          setSelectMode(!selectMode);
          setSelectedIds([]);
        }}
        className="fab fab-left"
      />

      <MaintenanceEntryModal
        open={showEditor}
        title={editorTitle}
        idPrefix="maintenance-entry"
        date={form.date}
        kilometers={form.kilometers}
        comment={form.comment}
        onDateChange={(value) =>
          setForm((current) => ({ ...current, date: value }))
        }
        onKilometersChange={(value) =>
          setForm((current) => ({ ...current, kilometers: value }))
        }
        onCommentChange={(value) =>
          setForm((current) => ({ ...current, comment: value }))
        }
        onSave={saveEditor}
        onClose={closeEditor}
        error={formError}
      >
        <>
          <label className="label">Categories</label>
          <div className="maintenance-category-grid">
            {categories.map((category) => (
              <label key={category.id} className="maintenance-category-option">
                <input
                  type="checkbox"
                  checked={form.categoryIds.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        </>
      </MaintenanceEntryModal>
    </main>
  );
}

export default MaintenanceHistory;
