/**
 * A small, curated airport reference set.
 *
 * Real deployments will seed from a full dataset (e.g. OurAirports / OpenFlights
 * into the `airports` table). For the mock provider and early UI we only need a
 * spread of European hubs with coordinates so we can estimate great-circle
 * distance and therefore plausible fares.
 */

export type Airport = {
  /** IATA code, uppercase. */
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};

export const AIRPORTS: readonly Airport[] = [
  { iata: "STR", name: "Stuttgart", city: "Stuttgart", country: "Germany", lat: 48.7833, lon: 9.1817 },
  { iata: "BCN", name: "Barcelona–El Prat", city: "Barcelona", country: "Spain", lat: 41.2974, lon: 2.0833 },
  { iata: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "Germany", lat: 52.3667, lon: 13.5033 },
  { iata: "MUC", name: "Munich", city: "Munich", country: "Germany", lat: 48.3538, lon: 11.7861 },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622 },
  { iata: "DUS", name: "Düsseldorf", city: "Düsseldorf", country: "Germany", lat: 51.2895, lon: 6.7668 },
  { iata: "HAM", name: "Hamburg", city: "Hamburg", country: "Germany", lat: 53.6304, lon: 9.9882 },
  { iata: "VIE", name: "Vienna", city: "Vienna", country: "Austria", lat: 48.1103, lon: 16.5697 },
  { iata: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland", lat: 47.4647, lon: 8.5492 },
  { iata: "AMS", name: "Amsterdam Schiphol", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683 },
  { iata: "CDG", name: "Paris Charles de Gaulle", city: "Paris", country: "France", lat: 49.0097, lon: 2.5479 },
  { iata: "ORY", name: "Paris Orly", city: "Paris", country: "France", lat: 48.7233, lon: 2.3794 },
  { iata: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom", lat: 51.47, lon: -0.4543 },
  { iata: "LGW", name: "London Gatwick", city: "London", country: "United Kingdom", lat: 51.1537, lon: -0.1821 },
  { iata: "STN", name: "London Stansted", city: "London", country: "United Kingdom", lat: 51.885, lon: 0.235 },
  { iata: "MAD", name: "Madrid–Barajas", city: "Madrid", country: "Spain", lat: 40.4936, lon: -3.5668 },
  { iata: "AGP", name: "Málaga", city: "Málaga", country: "Spain", lat: 36.6749, lon: -4.4991 },
  { iata: "PMI", name: "Palma de Mallorca", city: "Palma", country: "Spain", lat: 39.5517, lon: 2.7388 },
  { iata: "LIS", name: "Lisbon Humberto Delgado", city: "Lisbon", country: "Portugal", lat: 38.7756, lon: -9.1354 },
  { iata: "OPO", name: "Porto Francisco Sá Carneiro", city: "Porto", country: "Portugal", lat: 41.2481, lon: -8.6814 },
  { iata: "FCO", name: "Rome Fiumicino", city: "Rome", country: "Italy", lat: 41.8003, lon: 12.2389 },
  { iata: "MXP", name: "Milan Malpensa", city: "Milan", country: "Italy", lat: 45.6301, lon: 8.7255 },
  { iata: "ATH", name: "Athens Eleftherios Venizelos", city: "Athens", country: "Greece", lat: 37.9364, lon: 23.9445 },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "Türkiye", lat: 41.2753, lon: 28.7519 },
  { iata: "CPH", name: "Copenhagen", city: "Copenhagen", country: "Denmark", lat: 55.618, lon: 12.656 },
  { iata: "ARN", name: "Stockholm Arlanda", city: "Stockholm", country: "Sweden", lat: 59.6519, lon: 17.9186 },
  { iata: "OSL", name: "Oslo Gardermoen", city: "Oslo", country: "Norway", lat: 60.1939, lon: 11.1004 },
  { iata: "HEL", name: "Helsinki-Vantaa", city: "Helsinki", country: "Finland", lat: 60.3172, lon: 24.9633 },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "Ireland", lat: 53.4213, lon: -6.2701 },
  { iata: "NCE", name: "Nice Côte d'Azur", city: "Nice", country: "France", lat: 43.6584, lon: 7.2159 },
  { iata: "PRG", name: "Prague Václav Havel", city: "Prague", country: "Czechia", lat: 50.1008, lon: 14.26 },
  { iata: "WAW", name: "Warsaw Chopin", city: "Warsaw", country: "Poland", lat: 52.1657, lon: 20.9671 },
  { iata: "BUD", name: "Budapest Ferenc Liszt", city: "Budapest", country: "Hungary", lat: 47.4369, lon: 19.2556 },
  { iata: "TLL", name: "Tallinn", city: "Tallinn", country: "Estonia", lat: 59.4133, lon: 24.8328 },
];

const BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));

export function getAirport(iata: string): Airport | undefined {
  return BY_IATA.get(iata.toUpperCase());
}

export function isKnownAirport(iata: string): boolean {
  return BY_IATA.has(iata.toUpperCase());
}

/** Great-circle distance in kilometres between two points. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
