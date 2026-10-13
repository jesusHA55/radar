"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { isFlightProviderId, setFlightProvider } from "@/lib/flights";
import { sendTestEmail } from "@/lib/notifications";

export async function setProviderAction(formData: FormData): Promise<void> {
  await requireCurrentUser();

  const value = String(formData.get("provider") ?? "");
  if (!isFlightProviderId(value)) return;

  await setFlightProvider(value);
  revalidatePath("/settings");
  revalidatePath("/explore");
  revalidatePath("/search");
}

export type TestEmailState = { ok: boolean; message: string };

export async function sendTestEmailAction(
  _prev: TestEmailState,
  _formData: FormData,
): Promise<TestEmailState> {
  const user = await requireCurrentUser();
  const result = await sendTestEmail(user.email);

  return result.ok
    ? { ok: true, message: `Test email sent via ${result.channel} to ${user.email}.` }
    : { ok: false, message: `Delivery via ${result.channel} failed: ${result.error}` };
}
