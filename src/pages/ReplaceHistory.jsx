import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import MaintenanceEntryModal from "../components/MaintenanceEntryModal";
import { syncMileageIfHigher } from "../lib/mileage";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseTextItems(value) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeEntry(entry, index) {
  const legacyParts = Array.isArray(entry?.categories)
    ? entry.categories
    : typeof entry?.category === "string" && entry.category.trim()
      ? [entry.category.trim()]
      : [];
  const parts = Array.isArray(entry?.parts) ? entry.parts.filter(Boolean) : legacyParts;

  return {
    id: entry?.id || `replace-${index}-${Date.now()}`,
    parts,
    date: entry?.date || "",
    kilometers: entry?.kilometers || "",
    comment: entry?.comment || "",
  };
}

function createEmptyForm() {
  return {
    id: null,
    partsText: "",
    date: todayIsoDate(),
    kilometers: "",
    comment: "",
  };
}

function ReplaceHistory() {
  const navigate = useNavigate();
  const pressTimer = useRef(null);

  const [entries, setEntries] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [menuEntry, setMenuEntry] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTitle, setEditorTitle] = useState("Add Replace Entry");
  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let mounted = true;
    dbGet(STORAGE_KEYS.replaceHistory, []).then((storedEntries) => {
      if (!mounted) {
        return;
      }

      const normalized = storedEntries.map(normalizeEntry);
      const needsMigration = storedEntries.some((entry) => !Array.isArray(entry?.parts));

      setEntries(normalized);
      if (needsMigration) {
        dbSet(STORAGE_KEYS.replaceHistory, normalized);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [entries]);

  const saveEntries = async (nextEntries) => {
    setEntries(nextEntries);
    await dbSet(STORAGE_KEYS.replaceHistory, nextEntries);
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
    setEditorTitle("Add Replace Entry");
    setForm(createEmptyForm());
    setFormError("");
    setShowEditor(true);
  };

  const openEditEditor = (entry) => {
    setEditorTitle("Edit Replace Entry");
    setForm({
      id: entry.id,
      partsText: (entry.parts || []).join(", "),
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

  const saveEditor = async () => {
    const parts = parseTextItems(form.partsText);
    if (parts.length === 0) {
      setFormError("Enter at least one part name.");
      return;
    }

    const record = {
      id: form.id || createId("replace"),
      parts,
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

      <h2 className="page-title">Replace History</h2>

      <section className="list">
        {sortedEntries.length === 0 && (
          <article className="card">
            <p className="muted">No entries yet.</p>
          </article>
        )}
        {sortedEntries.map((entry) => (
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
              {(entry.parts || []).join(", ") || "No part listed"}
            </h3>
            <p className="item-row">Date: {entry.date || "N/A"}</p>
            <p className="item-row">Kilometers: {entry.kilometers || "N/A"}</p>
            <p className="item-row">Comment: {entry.comment || "N/A"}</p>
          </article>
        ))}
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
        idPrefix="replace-entry"
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
        <div>
          <label className="label" htmlFor="replace-parts-input">
            Part name(s)
          </label>
          <textarea
            id="replace-parts-input"
            className="textarea"
            placeholder="e.g. clutch, alternator, rear left wheel hub"
            value={form.partsText}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                partsText: event.target.value,
              }))
            }
          />
          <p className="item-row">Use comma or new line for multiple parts.</p>
        </div>
      </MaintenanceEntryModal>
    </main>
  );
}

export default ReplaceHistory;
