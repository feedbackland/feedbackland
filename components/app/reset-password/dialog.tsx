"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { ResetPasswordForm } from "./form";
import { Success } from "@/components/ui/success";
import { triggers } from "@/lib/utils";

export function ResetPasswordDialog() {
  const [token, setToken] = useQueryState(triggers.resetPasswordToken);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      setIsDialogOpen(true);
    }
  }, [token]);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setToken(null);
          setIsDialogOpen(false);
        }
      }}
    >
      <DialogContent className="max-w-[400px] pb-8">
        <DialogHeader>
          <DialogTitle className="h3 mb-5 text-center">
            Reset password
          </DialogTitle>
        </DialogHeader>
        {token && (
          <ResetPasswordForm
            token={token}
            onSuccess={() => {
              setToken(null);
              setIsSuccess(true);
            }}
          />
        )}

        {isSuccess && (
          <div className="mt-4">
            <Success
              title="Password reset successfully"
              description="Please check your email for the password reset link."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
