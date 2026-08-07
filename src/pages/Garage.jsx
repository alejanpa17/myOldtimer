import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getVehicleLabel,
  loadGarage,
  switchSelectedVehicle,
} from "../lib/garage";

function CarPlaceholder() {
  return (
    <span className="garage-car-placeholder" aria-hidden="true">
      <svg viewBox="0 0 64 40" focusable="false">
        <path d="M8 25h4l4-10c1-2.5 3.2-4 6-4h20c2.8 0 5 1.5 6 4l4 10h4c2.2 0 4 1.8 4 4v5H4v-5c0-2.2 1.8-4 4-4Zm12-9-3.3 9h30.6L44 16c-.4-.9-1.1-1.4-2-1.4H22c-.9 0-1.6.5-2 1.4ZM17 36a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm30 0a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
      </svg>
    </span>
  );
}

function AddVehicleIcon() {
  return (
    <span className="garage-add-icon" aria-hidden="true">
      <span className="garage-plus-circle">+</span>
    </span>
  );
}

function Garage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  useEffect(() => {
    let mounted = true;
    loadGarage().then((garage) => {
      if (!mounted) {
        return;
      }
      setVehicles(garage.vehicles);
      setSelectedVehicleId(garage.selectedVehicleId);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const selectVehicle = async (vehicle) => {
    if (vehicle.id === selectedVehicleId) {
      navigate("/vehicle");
      return;
    }

    const garage = await switchSelectedVehicle(
      vehicles,
      selectedVehicleId,
      vehicle.id
    );
    setVehicles(garage.vehicles);
    setSelectedVehicleId(garage.selectedVehicleId);
    navigate("/");
  };

  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">Your collection</p>
        <h2 className="page-title">Garage</h2>
        <p>Choose a vehicle to make its records active, or tap the current one to edit its profile.</p>
      </header>

      <section className="garage-page-grid" aria-label="Vehicles">
        {vehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            className={`garage-vehicle-card garage-page-card ${
              vehicle.id === selectedVehicleId ? "garage-vehicle-current" : ""
            }`}
            onClick={() => selectVehicle(vehicle)}
          >
            {vehicle.image ? (
              <img
                src={vehicle.image}
                alt={`${getVehicleLabel(vehicle)} profile`}
                className="garage-vehicle-thumb"
              />
            ) : (
              <CarPlaceholder />
            )}
            <span className="garage-vehicle-name">{getVehicleLabel(vehicle)}</span>
            {vehicle.id === selectedVehicleId && (
              <span className="garage-active-label">Active</span>
            )}
          </button>
        ))}

        <button
          type="button"
          className="garage-vehicle-card garage-page-card garage-add-card"
          onClick={() => navigate("/vehicle?new=1")}
        >
          <AddVehicleIcon />
          <span className="garage-vehicle-name">Add vehicle</span>
        </button>
      </section>
    </main>
  );
}

export default Garage;
