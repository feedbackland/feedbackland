"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { completeSetup } from "@/lib/setup";
import { DomainError } from "@/lib/domain-error";
export async function setupAction(
  _previous: { error: string } | null,
  form: FormData,
) {
  try {
    await completeSetup(
      {
        code: form.get("code"),
        platformTitle: form.get("platformTitle"),
        name: form.get("name"),
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
          : "Setup is temporarily unavailable. Try again later.",
    };
  }
  redirect("/admin");
}
