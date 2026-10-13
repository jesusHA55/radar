/**
 * Pure trip enumerations and labels.
 *
 * Kept free of zod/schema imports so client components can reference them
 * without pulling validation code into the browser bundle.
 */

export const TRIP_TYPES = ["one-way", "round-trip"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const CABIN_CLASSES = ["economy", "premium", "business", "first"] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  "one-way": "One way",
  "round-trip": "Round trip",
};

export const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "Economy",
  premium: "Premium economy",
  business: "Business",
  first: "First",
};

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isCabinClass(value: string): value is CabinClass {
  return (CABIN_CLASSES as readonly string[]).includes(value);
}

export function isTripType(value: string): value is TripType {
  return (TRIP_TYPES as readonly string[]).includes(value);
}
