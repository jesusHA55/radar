import { isKnownAirport } from "@/lib/domain/airports";
import { dateWindowFromParams, type DateWindow } from "@/lib/domain/date-window";
import { CABIN_CLASSES, TRIP_TYPES, type CabinClass, type TripType } from "@/lib/domain/trip";
import { pickEnum, pickInt, pickParam, type RawParams } from "@/lib/utils/params";
import { MEET_LIMITS, type MeetParticipant } from "./types";

/** Serialize a participant into the compact `origin|label` URL form. */
export function encodeParticipant(participant: MeetParticipant): string {
  return `${participant.origin.toUpperCase()}|${participant.label}`;
}

export function parseParticipant(entry: string): MeetParticipant | null {
  const [originRaw, ...labelParts] = entry.split("|");
  const origin = (originRaw ?? "").trim().toUpperCase();
  if (!isKnownAirport(origin)) return null;
  const label = labelParts.join("|").trim() || origin;
  return { origin, label };
}

export function parseParticipants(params: RawParams): MeetParticipant[] {
  const raw = params["p"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map(parseParticipant)
    .filter((p): p is MeetParticipant => p !== null)
    .slice(0, 8);
}

export const DEFAULT_PARTICIPANTS: MeetParticipant[] = [
  { origin: "STR", label: "You" },
  { origin: "MUC", label: "Friend" },
];

export type ParsedMeet = {
  participants: MeetParticipant[];
  window: DateWindow;
  togetherNights: number;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  currency: string;
  limit: number;
};

export function parseMeetParams(params: RawParams): ParsedMeet {
  const participants = parseParticipants(params);
  const window = dateWindowFromParams(params);

  const togetherNights = pickInt(params, "togetherNights", 5, 0, 30);
  const limitRaw = Number(pickParam(params, "limit"));
  const limit = (MEET_LIMITS as readonly number[]).includes(limitRaw) ? limitRaw : 10;

  return {
    participants: participants.length >= 2 ? participants : DEFAULT_PARTICIPANTS,
    window,
    togetherNights,
    tripType: pickEnum<TripType>(params, "tripType", TRIP_TYPES, "round-trip"),
    cabin: pickEnum<CabinClass>(params, "cabin", CABIN_CLASSES, "economy"),
    adults: pickInt(params, "adults", 1),
    currency: pickParam(params, "currency") ?? "EUR",
    limit,
  };
}
