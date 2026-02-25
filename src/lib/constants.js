export const DEFAULT_VEHICLE_INFO = {
  vin: "",
  brand: "",
  model: "",
  engine: "",
  fuelType: "",
  gearbox: "",
  modelYear: "",
  drive: "FWD",
  steering: "Left",
  region: "",
  exteriorColor: "",
  interiorColor: "",
  horsepower: "",
};

export const STORAGE_KEYS = {
  vehicleInfo: "vehicleInfo",
  vehicleImage: "vehicleImage",
  diagnosticsConnected: "diagnosticsConnected",
  currentFaultCodes: "currentFaultCodes",
  faultHistory: "faultHistory",
  replaceHistory: "replaceHistory",
  maintenanceHistory: "maintenanceHistory",
  maintenanceCategories: "maintenanceCategories",
  maintenanceServiceLogs: "maintenanceServiceLogs",
  maintenanceCurrentMileage: "maintenanceCurrentMileage",
  checklistData: "checklistData",
  fuelEfficiencyEntries: "fuelEfficiencyEntries",
  fuelEfficiencyMode: "fuelEfficiencyMode",
};

export const MAINTENANCE_CATEGORIES = [
  "Engine oil",
  "Air filter",
  "Fuel filter",
  "Spark plugs",
  "Coolant",
  "Brake fluid",
  "Gearbox oil",
  "Differential oil",
  "Technical inspection",
];

export const MAINTENANCE_OVERVIEW_ITEMS = [
  { name: "Engine oil", dueLabel: "Next due: 5,000 km" },
  { name: "Air filter", dueLabel: "Next due: 2026-08-01" },
  { name: "Fuel filter", dueLabel: "Next due: 2026-10-01" },
  { name: "Spark plugs", dueLabel: "Next due: 20,000 km" },
  { name: "Coolant", dueLabel: "Next due: 2027-01-15" },
  { name: "Brake fluid", dueLabel: "Next due: 2026-11-20" },
  { name: "Gearbox oil", dueLabel: "Next due: 40,000 km" },
  { name: "Differential oil", dueLabel: "Next due: 30,000 km" },
  { name: "Technical inspection", dueLabel: "Next due: 2026-12-05" },
];

export const DEFAULT_MAINTENANCE_CATEGORY_TEMPLATES = [
  {
    name: "Engine Oil",
    intervalType: "both",
    intervalMonths: 12,
    intervalKilometers: 10000,
  },
  {
    name: "Brake Fluid",
    intervalType: "time",
    intervalMonths: 24,
  },
  {
    name: "Coolant",
    intervalType: "time",
    intervalMonths: 36,
  },
  {
    name: "Air Filter",
    intervalType: "mileage",
    intervalKilometers: 15000,
  },
  {
    name: "Timing Belt",
    intervalType: "both",
    intervalMonths: 60,
    intervalKilometers: 90000,
  },
];

export const FAULT_CODE_CATALOG = [
  { code: "P0101", name: "Mass Air Flow Sensor Range/Performance" },
  { code: "P0171", name: "System Too Lean (Bank 1)" },
  { code: "P0300", name: "Random/Multiple Cylinder Misfire Detected" },
  { code: "P0420", name: "Catalyst System Efficiency Below Threshold" },
  { code: "P0500", name: "Vehicle Speed Sensor Malfunction" },
];
