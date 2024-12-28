"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SignInForm } from "./sign-in-form";
import { authClient } from "@/app/utils/client/auth-client";

export function SignInDialog() {
  const [open, setOpen] = useState(false);
  const { data: session } = authClient.useSession();

  if (!session) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => setOpen(true)}>Sign in</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
          </DialogHeader>
          <SignInForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    );
  }
}
