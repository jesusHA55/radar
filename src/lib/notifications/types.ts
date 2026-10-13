/** Notification domain types. */

export type AlertKind = "target" | "drop" | "all-time-low";

export type AlertPayload = {
  toEmail: string;
  watchId: string;
  watchLabel: string;
  origin: string;
  destination: string;
  originLabel: string;
  destinationLabel: string;
  kind: AlertKind;
  /** Current price in minor units. */
  priceMinor: number;
  /** Lowest price seen before this observation, if any. */
  previousLowMinor?: number;
  currency: string;
  departDate: string;
  returnDate?: string;
  tripType: string;
  cabin: string;
  adults: number;
};

export type DispatchResult = {
  ok: boolean;
  /** Delivery channel actually used, e.g. "gmail" | "resend" | "dev-log". */
  channel: string;
  error?: string;
  /** Present in dev (console transport) so the link can be shared manually. */
  devUrl?: string;
};
