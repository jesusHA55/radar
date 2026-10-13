"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { createSavedSearch, deleteSavedSearch, isSavedKind } from "./searches";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveSearchAction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();

  const kind = text(formData, "kind");
  const href = text(formData, "href");
  const label = text(formData, "label") || href;

  // Only accept same-origin app paths.
  if (!isSavedKind(kind) || !href.startsWith("/") || href.startsWith("//")) return;

  await createSavedSearch({ ownerId: user.id, kind, label, href });
  revalidatePath("/saved");
}

export async function deleteSavedSearchAction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const id = text(formData, "id");
  if (id) await deleteSavedSearch(user.id, id);
  revalidatePath("/saved");
}
