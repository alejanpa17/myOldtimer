export const AI_MODELS = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Google Search)",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash Lite Preview",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
  },
  {
    id: "gemini-3-pro-preview",
    label: "Gemini 3 Pro Preview",
  },
  {
    id: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image Preview",
  },
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;
export const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_TEMPERATURE = 0.3;
export const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

export function buildSystemPrompt() {
  return 'You are an assistant inside a vehicle maintenance PWA. Be concise and practical. Keep replies under 150 words unless the user asks for more detail. Always use plain text. Never include Markdown or HTML formatting in your responses. Only include JSON when proposing vehicle profile changes using {"assistantMessage":"string","proposedVehicleUpdates":{...}}. proposedVehicleUpdates must be a flat object (no nested "vehicle" object) and may only use these keys: vin, brand, model, generation, engine, fuelType, gearbox, modelYear, drive, steering, region, exteriorColor, interiorColor, horsepower. Never say vehicle info was updated; only propose updates. Ask for missing vehicle information when needed.';
}
