function VehicleImageEmptyState({
  onAdd,
  minHeight = 220,
  message = "No vehicle image yet",
  buttonLabel = "Add Vehicle",
}) {
  return (
    <div className="vehicle-image placeholder" style={{ minHeight }}>
      <div>
        <p className="muted">{message}</p>
        <button type="button" className="btn-primary" onClick={onAdd}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default VehicleImageEmptyState;
