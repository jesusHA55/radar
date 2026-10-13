"use server";

import { requestMagicLink } from "@/lib/auth/magic-link";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { requestOrigin } from "@/lib/utils/request-origin";

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
  const origin = await requestOrigin();

  const result = await requestMagicLink(email, origin, next === "/" ? undefined : next);

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not-invited"
          ? "That email isn't on the invite list."
          : result.reason === "rate-limited"
            ? "Too many sign-in links requested. Please try again later."
            : "Please enter a valid email address.",
    };
  }

  return {
    ok: true,
    message: `A sign-in link is on its way to ${email}.`,
    devUrl: result.devUrl,
  };
}
