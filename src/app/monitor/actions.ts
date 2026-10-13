"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { checkWatch } from "@/lib/monitor/engine";
import { parseWatchFormData } from "@/lib/monitor/form";
import {
  createWatch,
  deleteWatch,
  getWatch,
  setWatchActive,
} from "@/lib/monitor/queries";
import type { ActionState } from "@/lib/monitor/types";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createWatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireCurrentUser();

  const parsed = parseWatchFormData(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const watch = await createWatch({ ...parsed.input, ownerId: user.id });

  revalidatePath("/monitor");
  redirect(`/monitor/${watch.id}`);
}

export async function toggleWatchAction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const id = text(formData, "id");
  const isActive = text(formData, "isActive") === "true";

  const watch = await getWatch(id);
  if (!watch || watch.ownerId !== user.id) return;

  await setWatchActive(id, isActive);
  revalidatePath("/monitor");
  revalidatePath(`/monitor/${id}`);
}

export async function deleteWatchAction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const id = text(formData, "id");

  const watch = await getWatch(id);
  if (!watch || watch.ownerId !== user.id) return;

  await deleteWatch(id);
  revalidatePath("/monitor");
  redirect("/monitor");
}

export async function checkNowAction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const id = text(formData, "id");

  const watch = await getWatch(id);
  if (!watch || watch.ownerId !== user.id) return;

  await checkWatch(id, { reason: "manual" });
  revalidatePath("/monitor");
  revalidatePath(`/monitor/${id}`);
}
