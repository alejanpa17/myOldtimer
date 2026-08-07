import { useEffect, useMemo, useState } from "react";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import MaintenanceEntryModal from "../components/MaintenanceEntryModal";
import EditToggleButton from "../components/EditToggleButton";
import { syncMileageIfHigher } from "../lib/mileage";
import { parseExpenseAmount } from "../lib/expenses";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function createPartItem(name = "", price = "") {
  return {
    id: createId("part-item"),
    name,
    price,
  };
}

function normalizeEntry(entry, index) {
  const legacyParts = Array.isArray(entry?.categories)
    ? entry.categories
    : typeof entry?.category === "string" && entry.category.trim()
      ? [entry.category.trim()]
      : [];
  const parts = Array.isArray(entry?.parts)
    ? entry.parts.filter((part) => typeof part === "string" && part.trim())
    : legacyParts;
  const partItems = Array.isArray(entry?.partItems)
    ? entry.partItems
        .map((part, partIndex) => ({
          id: part?.id || `part-${partIndex}-${Date.now()}`,
          name: part?.name?.trim() || "",
          price: parseExpenseAmount(part?.price),
        }))
        .filter((part) => part.name)
    : parts.map((name, partIndex) => ({
        id: `legacy-part-${partIndex}-${Date.now()}`,
        name,
        price: null,
      }));

  return {
    id: entry?.id || `replace-${index}-${Date.now()}`,
    parts: partItems.map((part) => part.name),
    partItems,
    date: entry?.date || "",
    kilometers: entry?.kilometers || "",
    comment: entry?.comment || "",
  };
}

function createEmptyForm() {
  return {
    id: null,
    partItems: [createPartItem()],
    date: todayIsoDate(),
    kilometers: "",
    comment: "",
  };
}

function ReplaceHistory() {
  const [entries, setEntries] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
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
      const needsMigration = storedEntries.some(
        (entry) => !Array.isArray(entry?.parts) || !Array.isArray(entry?.partItems)
      );

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
      partItems: (entry.partItems || []).map((part) => ({
        id: part.id || createId("part-item"),
        name: part.name || "",
        price: part.price === null || part.price === undefined ? "" : String(part.price),
      })),
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

  const addPartItem = () => {
    setForm((current) => ({
      ...current,
      partItems: [...current.partItems, createPartItem()],
    }));
  };

  const updatePartItem = (partId, field, value) => {
    setForm((current) => ({
      ...current,
      partItems: current.partItems.map((part) =>
        part.id === partId ? { ...part, [field]: value } : part
      ),
    }));
  };

  const removePartItem = (partId) => {
    setForm((current) => ({
      ...current,
      partItems:
        current.partItems.length === 1
          ? current.partItems
          : current.partItems.filter((part) => part.id !== partId),
    }));
  };

  const saveEditor = async () => {
    const namedParts = form.partItems
      .map((part) => ({ ...part, name: part.name.trim() }))
      .filter((part) => part.name);
    if (namedParts.length === 0) {
      setFormError("Enter at least one part name.");
      return;
    }
    const invalidPrice = namedParts.some(
      (part) => part.price.trim() && parseExpenseAmount(part.price) === null
    );
    if (invalidPrice) {
      setFormError("Each price must be a valid non-negative number.");
      return;
    }
    const partItems = namedParts.map((part) => ({
      id: part.id,
      name: part.name,
      price: parseExpenseAmount(part.price),
    }));

    const record = {
      id: form.id || createId("replace"),
      parts: partItems.map((part) => part.name),
      partItems,
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
      <h2 className="page-title">Replace History</h2>

      <section className="list">
        {sortedEntries.length === 0 && (
          <article className="card">
            <p className="muted">No entries yet.</p>
          </article>
        )}
        {sortedEntries.map((entry) => {
          const pricedTotal = (entry.partItems || []).reduce(
            (sum, part) => sum + (parseExpenseAmount(part.price) || 0),
            0
          );
          return (
            <div
              key={entry.id}
              className={`maintenance-entry-row ${
                selectMode ? "maintenance-entry-row-manage" : ""
              }`}
            >
              <article className="card maintenance-entry-card">
                <h3 className="item-title">Replaced parts</h3>
                <div className="replacement-part-list">
                  {(entry.partItems || []).map((part) => (
                    <p className="replacement-part-row" key={part.id}>
                      <span>{part.name}</span>
                      <strong>{part.price === null ? "-" : part.price.toFixed(2)}</strong>
                    </p>
                  ))}
                </div>
                {pricedTotal > 0 && (
                  <p className="item-row">Parts total: {pricedTotal.toFixed(2)}</p>
                )}
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
                    aria-label={`Select replace entry ${entry.date || entry.id}`}
                    tabIndex={selectMode ? 0 : -1}
                  />
                </label>
                <button
                  type="button"
                  className="maintenance-gear-button"
                  onClick={() => openEditEditor(entry)}
                  aria-label={`Configure replace entry ${entry.date || entry.id}`}
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
        <div className="field-grid">
          <label className="label">Parts and prices</label>
          {form.partItems.map((part, index) => (
            <div className="replacement-part-editor" key={part.id}>
              <input
                className="input"
                aria-label={`Part ${index + 1} name`}
                placeholder={`Part ${index + 1}`}
                value={part.name}
                onChange={(event) => updatePartItem(part.id, "name", event.target.value)}
              />
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                aria-label={`Part ${index + 1} price`}
                placeholder="Price"
                value={part.price}
                onChange={(event) => updatePartItem(part.id, "price", event.target.value)}
              />
              <button
                type="button"
                className="replacement-remove-button"
                onClick={() => removePartItem(part.id)}
                disabled={form.partItems.length === 1}
                aria-label={`Remove part ${index + 1}`}
              >
                &times;
              </button>
            </div>
          ))}
          <button type="button" onClick={addPartItem}>Add another part</button>
        </div>
      </MaintenanceEntryModal>
    </main>
  );
}

export default ReplaceHistory;
