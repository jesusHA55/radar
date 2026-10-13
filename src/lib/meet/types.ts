import type { DateWindow } from "@/lib/domain/date-window";
import type { CabinClass, TripType } from "@/lib/domain/trip";
import type { Money } from "@/lib/flights/types";

/** One traveller: where they start, and what to call them. */
export type MeetParticipant = {
  label: string;
  origin: string;
};

export type MeetRequest = {
  participants: MeetParticipant[];
  /** Shared flexible travel window for everybody. */
  window: DateWindow;
  /** Desired nights spent together at the destination. */
  togetherNights: number;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  currency: string;
  limit: number;
};

/** One participant's cheapest leg to a candidate destination. */
export type MeetLeg = {
  label: string;
  origin: string;
  price: Money;
  departDate: string;
  returnDate?: string;
  carrierCode: string;
  carrierName: string;
  stops: number;
  durationMinutes: number;
};

export type MeetResult = {
  destination: string;
  city: string;
  country: string;
  /** Sum of every participant's leg. */
  total: Money;
  legs: MeetLeg[];
  /** Inclusive shared window where everyone can be together. */
  togetherFrom: string;
  togetherTo: string;
  togetherNights: number;
};

export const MEET_LIMITS = [5, 10, 25] as const;
export type MeetLimit = (typeof MEET_LIMITS)[number];
