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
import { SignUpIn } from ".";

export function SignUpInDialog({
  selectedMethod,
}: {
  selectedMethod: "sign-up" | "sign-in";
}) {
  const [open, setOpen] = useState(false);

  const handleSignUpIn = ({ userId }: { userId: string }) => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          {selectedMethod === "sign-in" ? "Sign in" : "Sign up"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sign up</DialogTitle>
        </DialogHeader>
        <SignUpIn
          defaultSelectedMethod={selectedMethod}
          onSuccess={handleSignUpIn}
        />
      </DialogContent>
    </Dialog>
  );
}
