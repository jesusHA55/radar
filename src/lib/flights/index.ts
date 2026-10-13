import { MockFlightProvider } from "./mock";
import type { FlightProvider } from "./types";

/**
 * Provider selection.
 *
 * `FLIGHT_PROVIDER=mock` (the default) keeps the app offline and free. Real
 * adapters (e.g. Air Scraper / SerpApi) plug in here behind the same interface
 * once you are ready to move off demo data — no feature code changes.
 *
 * Server-only by convention: never import this from a Client Component.
 */

let cached: FlightProvider | null = null;

export function getFlightProvider(): FlightProvider {
  if (cached) return cached;

  const id = process.env.FLIGHT_PROVIDER ?? "mock";

  switch (id) {
    case "mock":
      cached = new MockFlightProvider();
      break;
    // case "airscraper":
    //   cached = new AirScraperFlightProvider({ apiKey: requireEnv("AIRSCRAPER_API_KEY") });
    //   break;
    default:
      throw new Error(
        `Unknown FLIGHT_PROVIDER "${id}". Supported: "mock".`,
      );
  }

  return cached;
}

export type { FlightProvider } from "./types";
