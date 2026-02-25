import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbDelete, dbGet, dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import VehicleImageModal from "../components/VehicleImageModal";
import { parseNonNegativeMileage } from "../lib/mileage";

function Home() {
  const navigate = useNavigate();
  const [vehicleImage, setVehicleImage] = useState(null);
  const [vehicleInfo, setVehicleInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentMileageInput, setCurrentMileageInput] = useState("");
  const [mileageStatus, setMileageStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.vehicleImage, null),
      dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO),
      dbGet(STORAGE_KEYS.maintenanceCurrentMileage, ""),
    ]).then(([storedImage, storedInfo, storedMileage]) => {
      if (!mounted) {
        return;
      }
      setVehicleImage(storedImage);
      setVehicleInfo(storedInfo);
      setCurrentMileageInput(storedMileage === "" ? "" : String(storedMileage));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const vehicleLabel = useMemo(() => {
    const brand = vehicleInfo.brand?.trim();
    const model = vehicleInfo.model?.trim();
    if (brand || model) {
      return `${brand || "Vehicle"} ${model || ""}`.trim();
    }
    return "Vehicle";
  }, [vehicleInfo.brand, vehicleInfo.model]);

  const saveImage = async (imageDataUrl) => {
    await dbSet(STORAGE_KEYS.vehicleImage, imageDataUrl);
    setVehicleImage(imageDataUrl);
  };

  const removeImage = async () => {
    await dbDelete(STORAGE_KEYS.vehicleImage);
    setVehicleImage(null);
  };

  const saveCurrentMileage = async () => {
    const mileage = parseNonNegativeMileage(currentMileageInput);
    if (mileage === null) {
      setMileageStatus("Current mileage must be a valid non-negative number.");
      return;
    }
    await dbSet(STORAGE_KEYS.maintenanceCurrentMileage, mileage);
    setCurrentMileageInput(String(mileage));
    setMileageStatus("Current mileage saved.");
  };

  return (
    <main className="page">
      <div className="topbar">
        <h1 className="page-title">myOldtimer Garage</h1>
      </div>

      <section className="card stack">
        {vehicleImage ? (
          <img
            src={vehicleImage}
            alt={`${vehicleLabel} profile`}
            className="vehicle-image vehicle-image-clickable"
            onClick={() => setShowImageModal(true)}
          />
        ) : (
          <div className="vehicle-image placeholder">
            <div>
              <p className="muted">No vehicle image yet</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowImageModal(true)}
              >
                Add Vehicle
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card field-grid" style={{ marginTop: 12 }}>
        <h3 className="item-title" style={{ marginBottom: 0 }}>
          Vehicle Mileage
        </h3>
        <div className="maintenance-inline-row">
          <input
            className="input"
            inputMode="numeric"
            placeholder="Enter current mileage"
            value={currentMileageInput}
            onChange={(event) => {
              setCurrentMileageInput(event.target.value);
              setMileageStatus("");
            }}
          />
          <button type="button" onClick={saveCurrentMileage}>
            Save
          </button>
        </div>
        {mileageStatus && (
          <p
            className={
              mileageStatus.toLowerCase().includes("saved") ? "muted" : "warning"
            }
          >
            {mileageStatus}
          </p>
        )}
      </section>

      <section className="grid-buttons" style={{ marginTop: 14 }}>
        <button type="button" onClick={() => navigate("/vehicle")}>
          Vehicle Info
        </button>
        <button type="button" onClick={() => navigate("/diagnostics")}>
          Diagnostics
        </button>
        <button type="button" onClick={() => navigate("/maintenance")}>
          Maintenance
        </button>
        <button type="button" onClick={() => navigate("/checklist")}>
          Checklist
        </button>
        <button type="button" onClick={() => navigate("/parts-finder")}>
          Parts Finder
        </button>
        <button type="button" onClick={() => navigate("/fuel-efficiency")}>
          Fuel Efficiency
        </button>
        <button type="button" onClick={() => navigate("/ai")}>
          AI Chat
        </button>
      </section>

      <VehicleImageModal
        open={showImageModal}
        currentImage={vehicleImage}
        onClose={() => setShowImageModal(false)}
        onSave={saveImage}
        onRemove={removeImage}
      />
    </main>
  );
}

export default Home;
