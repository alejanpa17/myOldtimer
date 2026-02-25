import { useEffect, useMemo, useState } from "react";
import { dbGet, dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";

const PROVIDERS = [
  {
    id: "partsouq",
    name: "PartSouq",
    websiteUrl: "https://partsouq.com",
    searchUrl: (vin) =>
      `https://partsouq.com/en/search/all?q=${encodeURIComponent(vin)}`,
  },
];

function PartsFinder() {
  const [vehicleInfo, setVehicleInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [vinInput, setVinInput] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO).then((info) => {
      if (mounted) {
        setVehicleInfo(info);
        setVinInput(info.vin || "");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const vin = useMemo(() => vinInput.trim(), [vinInput]);
  const hasUnsavedChanges = vin !== (vehicleInfo.vin?.trim() || "");

  const saveVin = async () => {
    const trimmedVin = vinInput.trim();
    if (!trimmedVin) {
      setStatus("VIN cannot be empty.");
      return;
    }
    const nextVehicleInfo = {
      ...vehicleInfo,
      vin: trimmedVin,
    };
    await dbSet(STORAGE_KEYS.vehicleInfo, nextVehicleInfo);
    setVehicleInfo(nextVehicleInfo);
    setVinInput(trimmedVin);
    setStatus("VIN saved. Vehicle Info will use this value.");
  };

  return (
    <main className="page">
      <h2 className="page-title">Parts Finder</h2>

      <section className="card stack" style={{ marginBottom: 12 }}>
        <div>
          <label className="label" htmlFor="parts-vin">
            VIN
          </label>
          <input
            id="parts-vin"
            className="input"
            value={vinInput}
            onChange={(event) => {
              setVinInput(event.target.value);
              setStatus("");
            }}
            placeholder="Enter VIN"
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={saveVin}
          disabled={!hasUnsavedChanges}
        >
          Save VIN
        </button>
        {!vin && (
          <p className="warning" style={{ margin: 0 }}>
            Please enter and save VIN to enable provider search.
          </p>
        )}
        {status && <p className="muted" style={{ margin: 0 }}>{status}</p>}
      </section>

      <section className="provider-grid">
        {PROVIDERS.map((provider) => {
          const faviconUrl = new URL("/favicon.ico", provider.websiteUrl).toString();
          return (
            <button
              key={provider.id}
              type="button"
              className="provider-card"
              disabled={!vin}
              onClick={() =>
                window.open(provider.searchUrl(vin), "_blank", "noopener,noreferrer")
              }
            >
              <img
                src={faviconUrl}
                alt={`${provider.name} icon`}
                className="provider-icon"
                loading="lazy"
              />
              <span className="provider-name">{provider.name}</span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

export default PartsFinder;
