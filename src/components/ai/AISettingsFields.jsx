function AISettingsFields({
  apiKeyInput,
  onApiKeyChange,
  modelInput,
  onModelChange,
  models,
  temperatureInput,
  onTemperatureChange,
  maxOutputTokensInput,
  onMaxOutputTokensChange,
  settingsStatus,
}) {
  return (
    <section className="field-grid">
      <div>
        <label className="label" htmlFor="gemini-api-key">
          Gemini API Key
        </label>
        <input
          id="gemini-api-key"
          className="input"
          type="password"
          placeholder="Paste your API key"
          value={apiKeyInput}
          onChange={(event) => onApiKeyChange(event.target.value)}
        />
      </div>

      <div className="field-grid">
        <p className="item-row" style={{ margin: 0 }}>
          Use this button to get your API key.
        </p>
        <button
          type="button"
          onClick={() =>
            window.open("https://aistudio.google.com/api-keys", "_blank", "noopener,noreferrer")
          }
        >
          Get API Key
        </button>
      </div>

      <div>
        <label className="label" htmlFor="ai-model-select">
          Model
        </label>
        <select
          id="ai-model-select"
          className="select"
          value={modelInput}
          onChange={(event) => onModelChange(event.target.value)}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </div>

      <p className="item-row" style={{ margin: 0 }}>
        Pro models can require a paid plan and may be unavailable on free quotas.
      </p>
      <p className="item-row" style={{ margin: 0 }}>
        Select Gemini 2.5 Flash to enable Google Search grounding and source links.
      </p>

      <div>
        <label className="label" htmlFor="ai-temperature">
          Temperature
        </label>
        <input
          id="ai-temperature"
          className="input"
          type="number"
          min="0"
          max="2"
          step="0.1"
          inputMode="decimal"
          value={temperatureInput}
          onChange={(event) => onTemperatureChange(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="ai-max-output-tokens">
          Max output tokens
        </label>
        <input
          id="ai-max-output-tokens"
          className="input"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={maxOutputTokensInput}
          onChange={(event) => onMaxOutputTokensChange(event.target.value)}
        />
      </div>

      <p className="item-row" style={{ margin: 0 }}>
        Stored locally on this device only.
      </p>
      {settingsStatus && <p className="warning">{settingsStatus}</p>}
    </section>
  );
}

export default AISettingsFields;
