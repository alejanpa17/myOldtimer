import SaveCancelModal from "./SaveCancelModal";

function MaintenanceEntryModal({
  open,
  title,
  idPrefix,
  date,
  kilometers,
  cost,
  comment,
  onDateChange,
  onKilometersChange,
  onCostChange,
  onCommentChange,
  onSave,
  onClose,
  error,
  children,
}) {
  return (
    <SaveCancelModal
      open={open}
      title={title}
      onSave={onSave}
      onCancel={onClose}
      cancelLabel="Close"
    >
      <div className="field-grid">
        {children}

        <div>
          <label className="label" htmlFor={`${idPrefix}-date`}>
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            className="input"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor={`${idPrefix}-km`}>
            Kilometers
          </label>
          <input
            id={`${idPrefix}-km`}
            className="input"
            inputMode="numeric"
            value={kilometers}
            onChange={(event) => onKilometersChange(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor={`${idPrefix}-comment`}>
            Comment
          </label>
          <textarea
            id={`${idPrefix}-comment`}
            className="textarea"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
          />
        </div>

        {onCostChange && (
          <div>
            <label className="label" htmlFor={`${idPrefix}-cost`}>
              Cost (optional)
            </label>
            <input
              id={`${idPrefix}-cost`}
              type="number"
              inputMode="decimal"
              className="input"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={cost}
              onChange={(event) => onCostChange(event.target.value)}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="warning" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </SaveCancelModal>
  );
}

export default MaintenanceEntryModal;
