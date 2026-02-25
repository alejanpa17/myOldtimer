import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbDelete, dbGet, dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import VehicleImageModal from "../components/VehicleImageModal";
import ActionFeedbackModal from "../components/ActionFeedbackModal";
import VehicleImageEmptyState from "../components/VehicleImageEmptyState";

function VehicleInfo() {
  const navigate = useNavigate();
  const [savedInfo, setSavedInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [form, setForm] = useState(DEFAULT_VEHICLE_INFO);
  const [vehicleImage, setVehicleImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [status, setStatus] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO),
      dbGet(STORAGE_KEYS.vehicleImage, null),
    ]).then(([info, image]) => {
      if (!mounted) {
        return;
      }
      setSavedInfo(info);
      setForm(info);
      setVehicleImage(image);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const save = async () => {
    await dbSet(STORAGE_KEYS.vehicleInfo, form);
    setSavedInfo(form);
    setStatus("");
    setFeedbackMessage("Vehicle info saved locally.");
  };

  const cancel = () => {
    setForm(savedInfo);
    setStatus("");
    setFeedbackMessage("Changes reverted.");
  };

  const saveImage = async (imageDataUrl) => {
    await dbSet(STORAGE_KEYS.vehicleImage, imageDataUrl);
    setVehicleImage(imageDataUrl);
    setStatus("Vehicle photo updated.");
  };

  const removeImage = async () => {
    await dbDelete(STORAGE_KEYS.vehicleImage);
    setVehicleImage(null);
    setStatus("Vehicle photo removed.");
  };

  const closeFeedback = () => {
    setFeedbackMessage("");
  };

  const goHomeFromFeedback = () => {
    closeFeedback();
    navigate("/");
  };

  return (
    <main className="page">
      <h2 className="page-title">Vehicle Info</h2>
      <section className="card" style={{ marginBottom: 12, textAlign: "center" }}>
        {vehicleImage ? (
          <img
            src={vehicleImage}
            alt="Vehicle profile"
            className="vehicle-image vehicle-image-clickable"
            style={{ minHeight: 160 }}
            onClick={() => setShowImageModal(true)}
          />
        ) : (
          <VehicleImageEmptyState
            minHeight={160}
            onAdd={() => setShowImageModal(true)}
          />
        )}
        {vehicleImage && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Tap image to update or remove.
          </p>
        )}
      </section>
      <section className="card field-grid">
        <div>
          <label className="label" htmlFor="vin">
            VIN
          </label>
          <input
            id="vin"
            className="input"
            value={form.vin}
            onChange={(event) => setField("vin", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="brand">
            Brand
          </label>
          <input
            id="brand"
            className="input"
            value={form.brand}
            onChange={(event) => setField("brand", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            className="input"
            value={form.model}
            onChange={(event) => setField("model", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="engine">
            Engine
          </label>
          <input
            id="engine"
            className="input"
            value={form.engine}
            onChange={(event) => setField("engine", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="fuelType">
            Fuel type
          </label>
          <input
            id="fuelType"
            className="input"
            value={form.fuelType}
            onChange={(event) => setField("fuelType", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="gearbox">
            Gearbox
          </label>
          <input
            id="gearbox"
            className="input"
            value={form.gearbox}
            onChange={(event) => setField("gearbox", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="modelYear">
            Model year
          </label>
          <input
            id="modelYear"
            className="input"
            value={form.modelYear}
            onChange={(event) => setField("modelYear", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="drive">
            Drive
          </label>
          <select
            id="drive"
            className="select"
            value={form.drive}
            onChange={(event) => setField("drive", event.target.value)}
          >
            <option>FWD</option>
            <option>RWD</option>
            <option>AWD</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="steering">
            Steering
          </label>
          <select
            id="steering"
            className="select"
            value={form.steering}
            onChange={(event) => setField("steering", event.target.value)}
          >
            <option>Left</option>
            <option>Right</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="region">
            Region
          </label>
          <input
            id="region"
            className="input"
            value={form.region}
            onChange={(event) => setField("region", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="exteriorColor">
            Exterior color
          </label>
          <input
            id="exteriorColor"
            className="input"
            value={form.exteriorColor}
            onChange={(event) => setField("exteriorColor", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="interiorColor">
            Interior color
          </label>
          <input
            id="interiorColor"
            className="input"
            value={form.interiorColor}
            onChange={(event) => setField("interiorColor", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="horsepower">
            Horsepower
          </label>
          <input
            id="horsepower"
            className="input"
            value={form.horsepower}
            onChange={(event) => setField("horsepower", event.target.value)}
          />
        </div>
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={save}>
            Save
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
        {status && <p className="muted">{status}</p>}
      </section>

      <VehicleImageModal
        open={showImageModal}
        currentImage={vehicleImage}
        onClose={() => setShowImageModal(false)}
        onSave={saveImage}
        onRemove={removeImage}
      />

      <ActionFeedbackModal
        open={Boolean(feedbackMessage)}
        title="Vehicle Info"
        message={feedbackMessage}
        onClose={closeFeedback}
        onGoHome={goHomeFromFeedback}
      />
    </main>
  );
}

export default VehicleInfo;
