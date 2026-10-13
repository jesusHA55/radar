import { isKnownAirport } from "@/lib/domain/airports";
import { dateWindowFromParams } from "@/lib/domain/date-window";
import type { NewWatchInput } from "./queries";
import {
  isCabinValue,
  isThresholdType,
  isTripTypeValue,
  type ThresholdType,
} from "./types";

/**
 * Parses and validates a watch form submission into a persistable input.
 *
 * Kept free of Next/server-action concerns so it can be unit tested directly.
 */

export type ParsedWatch = Omit<NewWatchInput, "ownerId">;

export type ParseResult =
  | { ok: true; input: ParsedWatch }
  | { ok: false; error: string };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function rawParams(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function parseWatchFormData(formData: FormData): ParseResult {
  const origin = text(formData, "origin").toUpperCase();
  const destination = text(formData, "destination").toUpperCase();

  if (!isKnownAirport(origin) || !isKnownAirport(destination)) {
    return { ok: false, error: "Please choose valid airports." };
  }
  if (origin === destination) {
    return { ok: false, error: "Origin and destination must differ." };
  }

  const tripType = text(formData, "tripType");
  const cabin = text(formData, "cabin");
  if (!isTripTypeValue(tripType) || !isCabinValue(cabin)) {
    return { ok: false, error: "Invalid trip or cabin selection." };
  }

  const thresholdTypeRaw = text(formData, "thresholdType");
  const thresholdType: ThresholdType = isThresholdType(thresholdTypeRaw)
    ? thresholdTypeRaw
    : "any-low";

  let thresholdValue: number | null = null;
  if (thresholdType === "target") {
    const amount = Number(text(formData, "thresholdAmount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a positive target price." };
    }
    thresholdValue = Math.round(amount * 100);
  } else if (thresholdType === "drop-percent") {
    const percent = Number(text(formData, "dropPercent"));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 90) {
      return { ok: false, error: "Enter a drop between 1% and 90%." };
    }
    thresholdValue = Math.round(percent);
  }

  const dateWindow = dateWindowFromParams(rawParams(formData));
  const adults = Math.min(9, Math.max(1, Number(text(formData, "adults")) || 1));
  const cadenceMinutes = Number(text(formData, "cadenceMinutes")) || 720;
  const dateSamples = Math.min(10, Math.max(1, Number(text(formData, "dateSamples")) || 1));
  const currency = text(formData, "currency") || "EUR";

  return {
    ok: true,
    input: {
      label: text(formData, "label") || null,
      origin,
      destination,
      tripType,
      cabin,
      adults,
      currency,
      dateWindow,
      thresholdType,
      thresholdValue,
      cadenceMinutes,
      dateSamples,
    },
  };
}
