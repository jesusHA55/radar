import { readFileSync } from "node:fs";

/**
 * The current public URL, as produced by the Cloudflare quick tunnel.
 *
 * `scripts`/systemd writes the URL to a file when the tunnel starts; the app
 * just reads it so `/settings` can show the live address. `PUBLIC_URL` overrides
 * it (e.g. when running behind a named tunnel with a stable hostname).
 */

const DEFAULT_FILE = "/var/lib/radar/tunnel-url.txt";

export function tunnelUrl(): string | null {
  const override = process.env.PUBLIC_URL?.trim();
  if (override) return override;

  const file = process.env.TUNNEL_URL_FILE ?? DEFAULT_FILE;
  try {
    return readFileSync(file, "utf8").trim() || null;
  } catch {
    return null;
  }
}
