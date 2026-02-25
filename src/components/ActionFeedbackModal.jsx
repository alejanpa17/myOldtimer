function ActionFeedbackModal({
  open,
  title = "Done",
  message,
  onClose,
  onGoHome,
  homeLabel = "Go Home",
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal feedback-modal">
        <button
          type="button"
          className="feedback-close"
          aria-label="Close feedback popup"
          onClick={onClose}
        >
          X
        </button>

        <div className="stack">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="item-row" style={{ margin: 0 }}>
            {message}
          </p>
        </div>

        <div className="feedback-home-wrap">
          <button
            type="button"
            className="btn-primary feedback-home-btn"
            onClick={onGoHome}
          >
            {homeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionFeedbackModal;
