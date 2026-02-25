function SaveCancelModal({
  open,
  title,
  onSave,
  onCancel,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  children,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal stack">
        <h3 style={{ margin: 0 }}>{title}</h3>
        {children}
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={onSave}>
            {saveLabel}
          </button>
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveCancelModal;
