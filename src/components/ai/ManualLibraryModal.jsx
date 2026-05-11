function ManualLibraryModal({
  open,
  manualUrls,
  urlInput,
  status,
  onUrlInputChange,
  onAdd,
  onDelete,
  onClose,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal stack">
        <div className="modal-title-row">
          <h3 style={{ margin: 0 }}>Manual Sources</h3>
          <button
            type="button"
            className="feedback-close modal-close-inline"
            aria-label="Close manual sources"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div>
          <label className="label" htmlFor="manual-url-input">
            Direct PDF URL
          </label>
          <input
            id="manual-url-input"
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://example.com/workshop-manual.pdf"
            value={urlInput}
            onChange={(event) => onUrlInputChange(event.target.value)}
          />
          <p className="item-row" style={{ marginBottom: 0 }}>
            Use public, direct PDF links. Gemini retrieves these with URL Context.
          </p>
        </div>

        <button type="button" className="btn-primary" onClick={onAdd}>
          Add URL
        </button>

        {status && (
          <p
            className={status.toLowerCase().includes("saved") ? "muted" : "warning"}
            style={{ margin: 0 }}
          >
            {status}
          </p>
        )}

        <section className="list">
          {manualUrls.length === 0 && (
            <article className="card">
              <p className="muted" style={{ margin: 0 }}>
                No manual URLs added.
              </p>
            </article>
          )}
          {manualUrls.map((manual) => (
            <article className="card manual-library-item" key={manual.id}>
              <div>
                <h4 className="item-title">{manual.title || "Workshop manual"}</h4>
                <p className="item-row">{manual.url}</p>
              </div>
              <button
                type="button"
                className="btn-danger manual-delete-button"
                onClick={() => onDelete(manual.id)}
              >
                Delete
              </button>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default ManualLibraryModal;
