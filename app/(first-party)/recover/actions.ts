"use server";
import { headers } from "next/headers";
import { DomainError } from "@/lib/domain-error";
import { completeRecovery } from "@/lib/recovery";
export async function recoveryAction(
  _previous: {
    error?: string;
    restored?: boolean;
    previousPassword?: boolean;
  } | null,
  form: FormData,
): Promise<{ error?: string; restored?: boolean; previousPassword?: boolean }> {
  try {
    return await completeRecovery(
      {
        code: form.get("code"),
        email: form.get("email"),
        password: form.get("password"),
      },
      new Headers(await headers()),
    );
  } catch (error) {
    return {
      error:
        error instanceof DomainError
          ? error.message
          : "Recovery is temporarily unavailable. The password may already have changed; retry with the same code when it is available.",
    };
  }
}
