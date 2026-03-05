import { Fragment } from "react";

function VehicleProfileUpdateFields({ rows, formatFieldLabel, onChange }) {
  return (
    <section className="field-grid">
      <p className="item-row" style={{ margin: 0 }}>
        AI suggests updating these fields:
      </p>
      <div className="ai-update-diff-grid">
        <div className="ai-update-diff-header">Previous Value</div>
        <div className="ai-update-diff-header">New Value</div>
        {(rows || []).map((row) => (
          <Fragment key={`pending-update-${row.field}`}>
            <div className="ai-update-diff-cell">
              <span className="ai-update-field-label">{formatFieldLabel(row.field)}:</span>{" "}
              {row.previousValue}
            </div>
            <div className="ai-update-diff-cell">
              <label className="label ai-update-edit-label" htmlFor={`ai-update-${row.field}`}>
                {formatFieldLabel(row.field)}
              </label>
              <input
                id={`ai-update-${row.field}`}
                className="input ai-update-edit-input"
                value={row.newValue}
                onChange={(event) => onChange(row.field, event.target.value)}
              />
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

export default VehicleProfileUpdateFields;
