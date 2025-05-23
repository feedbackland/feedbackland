"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { useQueryState } from "nuqs";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState } from "react";

export function RedeemAdminInvitation() {
  const trpc = useTRPC();
  const { session, isLoaded, signOut } = useAuth();
  const [adminInviteToken, setAdminInviteToken] =
    useQueryState("admin-invite-token");
  const [adminInviteEmail, setAdminInviteEmail] =
    useQueryState("admin-invite-email");
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);

  const redeemInvitation = useMutation(
    trpc.redeemAdminInvite.mutationOptions(),
  );

  const triggerRedeem = useCallback(async () => {
    if (adminInviteToken) {
      await redeemInvitation.mutateAsync({
        adminInviteToken: adminInviteToken,
      });
      setAdminInviteToken(null);
      setAdminInviteEmail(null);
      window.location.reload();
    }
  }, [
    adminInviteToken,
    redeemInvitation,
    setAdminInviteToken,
    setAdminInviteEmail,
  ]);

  useEffect(() => {
    if (isLoaded && adminInviteToken && adminInviteEmail) {
      if (!session) {
        setShowSignUpDialog(true);
      } else if (session && session.user.email === adminInviteEmail) {
        triggerRedeem();
      } else if (session && session.user.email !== adminInviteEmail) {
        signOut().then(() => window.location.reload());
      }
    }
  }, [
    adminInviteToken,
    adminInviteEmail,
    session,
    isLoaded,
    triggerRedeem,
    signOut,
  ]);

  const handleOnClose = () => {
    setAdminInviteToken(null);
    setAdminInviteEmail(null);
  };

  return (
    <SignUpInDialog
      open={showSignUpDialog}
      initialSelectedMethod="sign-up"
      onClose={handleOnClose}
      onSuccess={triggerRedeem}
    />
  );
}
