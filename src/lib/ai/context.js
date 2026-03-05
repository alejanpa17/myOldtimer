import { SEARCH_INTENT_KEYWORDS } from "./constants";

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
    engine: clean(vehicleInfo.engine),
    year: clean(vehicleInfo.modelYear),
    region: clean(vehicleInfo.region),
    brand: clean(vehicleInfo.brand),
    vin: clean(vehicleInfo.vin),
  };
}

export function shouldUseSearchGrounding(userText) {
  const normalized = userText.toLowerCase();
  return SEARCH_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
