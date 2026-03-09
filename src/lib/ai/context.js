export function buildVehicleContext(vehicleInfo) {
  const clean = (value) => {
    if (!value) {
      return null;
    }
    const next = String(value).trim();
    return next || null;
  };

  return {
    model: clean(vehicleInfo.model),
    generation: clean(vehicleInfo.generation),
    engine: clean(vehicleInfo.engine),
    year: clean(vehicleInfo.modelYear),
    region: clean(vehicleInfo.region),
    brand: clean(vehicleInfo.brand),
    vin: clean(vehicleInfo.vin),
  };
}
