function EditToggleButton({ active, onClick, label = "Edit Mode", className = "" }) {
  return (
    <button
      type="button"
      className={`icon-toggle-button ${active ? "icon-toggle-active" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-label={active ? `Close ${label}` : label}
      title={active ? `Close ${label}` : label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M4 5h10a2 2 0 0 1 2 2v2h-2V7H4v12h10v-2h2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
          fill="currentColor"
        />
        <path
          d="m13.6 16.8 4.9-4.9 1.6 1.6-4.9 4.9-2.4.8.8-2.4Zm6-6-1.6-1.6 1-1a1.1 1.1 0 0 1 1.6 0l1 1a1.1 1.1 0 0 1 0 1.6l-1 1Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}

export default EditToggleButton;
