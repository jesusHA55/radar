/**
 * Loads `.env.local` for CLI scripts.
 *
 * Next.js loads environment files automatically; scripts run under `tsx` do
 * not, so we read the same file explicitly (Node's built-in loader).
 */
export function loadLocalEnv(): void {
  const loader = (process as unknown as { loadEnvFile?: (path?: string) => void })
    .loadEnvFile;
  try {
    loader?.(".env.local");
  } catch {
    // No .env.local — rely on the real environment / defaults.
  }
}
