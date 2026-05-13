import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import VehicleImageModal from "../components/VehicleImageModal";
import ActionFeedbackModal from "../components/ActionFeedbackModal";
import VehicleImageEmptyState from "../components/VehicleImageEmptyState";
import { parseNonNegativeMileage } from "../lib/mileage";
import {
  createVehicleRecord,
  getSelectedVehicle,
  loadGarage,
  normalizeVehicleInfo,
  saveVehicles,
  syncCurrentVehicle,
} from "../lib/garage";

const REQUIRED_IDENTITY_FIELDS = ["vin", "brand", "model"];

function hasRequiredVehicleIdentity(info) {
  return REQUIRED_IDENTITY_FIELDS.some((field) => info[field]?.trim());
}

function VehicleInfo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewVehicle = searchParams.get("new") === "1";
  const [savedInfo, setSavedInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [form, setForm] = useState(DEFAULT_VEHICLE_INFO);
  const [savedMileageInput, setSavedMileageInput] = useState("");
  const [mileageInput, setMileageInput] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [vehicleImage, setVehicleImage] = useState(null);
  const [savedVehicleImage, setSavedVehicleImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [status, setStatus] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [showIdentityErrors, setShowIdentityErrors] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadGarage().then((garage) => {
      if (!mounted) {
        return;
      }

      setVehicles(garage.vehicles);
      setSelectedVehicleId(garage.selectedVehicleId);

      if (isNewVehicle) {
        setSavedInfo(DEFAULT_VEHICLE_INFO);
        setForm(DEFAULT_VEHICLE_INFO);
        setSavedMileageInput("");
        setMileageInput("");
        setVehicleImage(null);
        setSavedVehicleImage(null);
        return;
      }

      const selectedVehicle = garage.selectedVehicle;
      const normalizedInfo = normalizeVehicleInfo(selectedVehicle?.info);
      const mileage =
        selectedVehicle?.mileage === "" ? "" : String(selectedVehicle?.mileage ?? "");
      setSavedInfo(normalizedInfo);
      setForm(normalizedInfo);
      setSavedMileageInput(mileage);
      setMileageInput(mileage);
      setVehicleImage(selectedVehicle?.image || null);
      setSavedVehicleImage(selectedVehicle?.image || null);
    });
    return () => {
      mounted = false;
    };
  }, [isNewVehicle]);

  const setField = (key, value) => {
    setForm((current) => {
      const nextForm = {
        ...current,
        [key]: value,
      };
      if (REQUIRED_IDENTITY_FIELDS.includes(key) && hasRequiredVehicleIdentity(nextForm)) {
        setShowIdentityErrors(false);
        setStatus("");
      }
      return nextForm;
    });
  };

  const save = async () => {
    const mileage = parseNonNegativeMileage(mileageInput);
    if (mileageInput.trim() && mileage === null) {
      setStatus("Current mileage must be a valid non-negative number.");
      return;
    }

    const currentVehicle = getSelectedVehicle(vehicles, selectedVehicleId);
    if (!hasRequiredVehicleIdentity(form)) {
      setShowIdentityErrors(true);
      setStatus("Enter a VIN, brand, or model before saving.");
      return;
    }

    const now = new Date().toISOString();
    const nextMileage = mileage === null ? "" : mileage;
    let nextVehicle = null;
    let nextVehicles = [];

    if (isNewVehicle) {
      nextVehicle = createVehicleRecord({
        info: form,
        image: vehicleImage,
        mileage: nextMileage,
        createdAt: now,
        updatedAt: now,
      });
      nextVehicles = [...vehicles, nextVehicle];
    } else {
      nextVehicle = {
        ...(currentVehicle ||
          createVehicleRecord({ id: selectedVehicleId || undefined })),
        info: normalizeVehicleInfo(form),
        image: vehicleImage,
        mileage: nextMileage,
        updatedAt: now,
      };
      nextVehicles = vehicles.map((vehicle) =>
        vehicle.id === nextVehicle.id ? nextVehicle : vehicle
      );
      if (!nextVehicles.some((vehicle) => vehicle.id === nextVehicle.id)) {
        nextVehicles = [...nextVehicles, nextVehicle];
      }
    }

    await saveVehicles(nextVehicles, nextVehicle.id);
    await syncCurrentVehicle(nextVehicle);
    setVehicles(nextVehicles);
    setSelectedVehicleId(nextVehicle.id);
    setSavedInfo(normalizeVehicleInfo(form));
    setSavedVehicleImage(vehicleImage);
    setSavedMileageInput(mileage === null ? "" : String(mileage));
    setMileageInput(mileage === null ? "" : String(mileage));
    setShowIdentityErrors(false);
    setStatus("");
    setFeedbackMessage(isNewVehicle ? "Vehicle added and selected." : "Vehicle info saved locally.");
  };

  const cancel = () => {
    if (isNewVehicle) {
      navigate("/");
      return;
    }
    setForm(savedInfo);
    setMileageInput(savedMileageInput);
    setVehicleImage(savedVehicleImage);
    setShowIdentityErrors(false);
    setStatus("");
    setFeedbackMessage("Changes reverted.");
  };

  const saveImage = async (imageDataUrl) => {
    setVehicleImage(imageDataUrl);
    setStatus("Vehicle photo updated.");
    if (!isNewVehicle) {
      await dbSet(STORAGE_KEYS.vehicleImage, imageDataUrl);
    }
  };

  const removeImage = async () => {
    setVehicleImage(null);
    setStatus("Vehicle photo removed.");
    if (!isNewVehicle) {
      await dbSet(STORAGE_KEYS.vehicleImage, null);
    }
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
      <h2 className="page-title">{isNewVehicle ? "Add Vehicle" : "Vehicle Info"}</h2>
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
            className={`input ${showIdentityErrors ? "input-error" : ""}`}
            value={form.vin}
            onChange={(event) => setField("vin", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="currentMileage">
            Current mileage
          </label>
          <input
            id="currentMileage"
            className="input"
            inputMode="numeric"
            placeholder="Enter current mileage"
            value={mileageInput}
            onChange={(event) => {
              setMileageInput(event.target.value);
              setStatus("");
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="brand">
            Brand
          </label>
          <input
            id="brand"
            className={`input ${showIdentityErrors ? "input-error" : ""}`}
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
            className={`input ${showIdentityErrors ? "input-error" : ""}`}
            value={form.model}
            onChange={(event) => setField("model", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="generation">
            Generation
          </label>
          <input
            id="generation"
            className="input"
            value={form.generation}
            onChange={(event) => setField("generation", event.target.value)}
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
