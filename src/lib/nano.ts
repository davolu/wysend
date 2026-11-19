export type NanoAvailability = "unknown" | "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

type LanguageModelLike = {
  availability: () => Promise<string>;
};

export async function probeOnDeviceAvailability(): Promise<NanoAvailability> {
  const candidate = (globalThis as { LanguageModel?: LanguageModelLike }).LanguageModel;
  if (!candidate || typeof candidate.availability !== "function") return "unsupported";
  try {
    const value = await candidate.availability();
    if (value === "available" || value === "downloadable" || value === "downloading" || value === "unavailable") {
      return value;
    }
    return "unavailable";
  } catch {
    return "unsupported";
  }
}

export function describeAvailability(value: NanoAvailability): string {
  switch (value) {
    case "available":
      return "Chrome reports Gemini Nano is on this device. Prepare it once so Firebase AI Logic can use it.";
    case "downloadable":
      return "Gemini Nano can be downloaded. Prepare it from a click. Until then, on-device rules still redact.";
    case "downloading":
      return "Gemini Nano is downloading. Rules keep redacting while that finishes.";
    case "unavailable":
      return "Gemini Nano is unavailable in this Chrome profile. Redaction stays on local rules and never falls back to the cloud.";
    case "unsupported":
      return "This Chrome build has no Prompt API. Enable the on-device model flag, or keep using local rules.";
    default:
      return "Checking whether Gemini Nano is on this device.";
  }
}
