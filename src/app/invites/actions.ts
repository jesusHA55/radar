"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { createInvite, deleteInvite } from "@/lib/invites/queries";
import { requestOrigin } from "@/lib/utils/request-origin";

export type InviteActionState = {
  ok: boolean;
  message: string;
  /** Present only in dev when email is not configured. */
  devUrl?: string;
};

export async function createInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const user = await requireCurrentUser();

  const email = String(formData.get("email") ?? "");
  const alsoSend = formData.get("send") === "on";

  const result = await createInvite(email, user.id);
  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  let devUrl: string | undefined;
  if (alsoSend) {
    const link = await requestMagicLink(result.email, await requestOrigin(), "/");
    devUrl = link.devUrl;
  }

  revalidatePath("/invites");
  return {
    ok: true,
    message: alsoSend
      ? `Invited ${result.email} and sent a sign-in link.`
      : `Invited ${result.email}.`,
    devUrl,
  };
}

export async function sendInviteLinkAction(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  await requestMagicLink(email, await requestOrigin(), "/");
  revalidatePath("/invites");
}

export async function deleteInviteAction(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteInvite(id);
  revalidatePath("/invites");
}
