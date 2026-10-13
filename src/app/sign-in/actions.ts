"use server";

import { headers } from "next/headers";

import { requestMagicLink } from "@/lib/auth/magic-link";
import { safeRedirectPath } from "@/lib/auth/redirect";

export type SignInState = {
  ok: boolean;
  message: string;
  /** Present only in dev when email is not configured. */
  devUrl?: string;
};

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeRedirectPath(String(formData.get("next") ?? ""), "/");

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const result = await requestMagicLink(email, origin, next === "/" ? undefined : next);

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not-invited"
          ? "That email isn't on the invite list."
          : "Please enter a valid email address.",
    };
  }

  return {
    ok: true,
    message: `A sign-in link is on its way to ${email}.`,
    devUrl: result.devUrl,
  };
}
