import { getCurrentUser } from "@/lib/auth/current-user";
import { tunnelUrl } from "@/lib/host/tunnel";

/** Auth-protected: the current public tunnel URL, for the settings screen. */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ url: tunnelUrl() });
}
