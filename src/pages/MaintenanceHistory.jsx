import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import MaintenanceEntryModal from "../components/MaintenanceEntryModal";
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
  const navigate = useNavigate();
  const pressTimer = useRef(null);

  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [menuEntry, setMenuEntry] = useState(null);
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

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleLongPressStart = (entry) => {
    clearTimer();
    pressTimer.current = setTimeout(() => {
      setMenuEntry(entry);
    }, 550);
  };

  const deleteSingle = async (id) => {
    const nextEntries = entries.filter((entry) => entry.id !== id);
    await saveEntries(nextEntries);
    setMenuEntry(null);
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
    setMenuEntry(null);
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
      <div className="topbar">
        <button type="button" onClick={() => navigate("/maintenance")}>
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectMode(!selectMode);
            setSelectedIds([]);
          }}
        >
          {selectMode ? "Cancel Select" : "Edit Mode"}
        </button>
      </div>

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
            <article
              key={entry.id}
              className="card"
              onPointerDown={() => handleLongPressStart(entry)}
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
            >
              {selectMode && (
                <label className="item-row" style={{ display: "flex", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => toggleSelect(entry.id)}
                  />
                  Select
                </label>
              )}
              <h3 className="item-title">
                {names.join(", ") || "No linked category"}
              </h3>
              <p className="item-row">Date: {entry.date || "N/A"}</p>
              <p className="item-row">Kilometers: {entry.kilometers || "N/A"}</p>
              <p className="item-row">Comment: {entry.comment || "N/A"}</p>
            </article>
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

      {menuEntry && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal stack">
            <h3 style={{ margin: 0 }}>Entry Actions</h3>
            <button type="button" onClick={() => openEditEditor(menuEntry)}>
              Edit
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => deleteSingle(menuEntry.id)}
            >
              Delete
            </button>
            <button type="button" onClick={() => setMenuEntry(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
