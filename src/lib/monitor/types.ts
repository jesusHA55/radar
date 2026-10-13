import type { CabinClass, TripType } from "@/lib/domain/trip";

export const THRESHOLD_TYPES = ["target", "drop-percent", "any-low"] as const;
export type ThresholdType = (typeof THRESHOLD_TYPES)[number];

export const THRESHOLD_LABELS: Record<ThresholdType, string> = {
  target: "At or below a target price",
  "drop-percent": "Drops a % below the previous low",
  "any-low": "Any new lowest price",
};

export function isThresholdType(value: string): value is ThresholdType {
  return (THRESHOLD_TYPES as readonly string[]).includes(value);
}

export function isTripTypeValue(value: string): value is TripType {
  return value === "one-way" || value === "round-trip";
}

export function isCabinValue(value: string): value is CabinClass {
  return ["economy", "premium", "business", "first"].includes(value);
}

/** Human description of a watch's trigger. */
export function describeThreshold(
  type: string,
  value: number | null,
  currency: string,
): string {
  if (type === "target" && value != null) {
    return `Alert at or below ${(value / 100).toFixed(0)} ${currency}`;
  }
  if (type === "drop-percent") {
    return `Alert on a ${value ?? 10}% drop below the previous low`;
  }
  return "Alert on any new lowest price";
}

/** Result shape returned by monitor server actions. */
export type ActionState = {
  ok: boolean;
  error?: string;
};

export const CADENCE_OPTIONS = [
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Daily" },
  { value: 10080, label: "Weekly" },
] as const;
