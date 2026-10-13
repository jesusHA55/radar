"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { isFlightProviderId, setFlightProvider } from "@/lib/flights";

export async function setProviderAction(formData: FormData): Promise<void> {
  await requireCurrentUser();

  const value = String(formData.get("provider") ?? "");
  if (!isFlightProviderId(value)) return;

  await setFlightProvider(value);
  revalidatePath("/settings");
  revalidatePath("/explore");
  revalidatePath("/search");
}
