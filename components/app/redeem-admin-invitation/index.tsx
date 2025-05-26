"use client";

import { useQueryState } from "nuqs";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState } from "react";
import { useRedeemAdminInvite } from "@/hooks/use-redeem-admin-invite";

export function RedeemAdminInvitation() {
  const { session, isLoaded, signOut } = useAuth();
  const [adminInviteToken, setAdminInviteToken] =
    useQueryState("admin-invite-token");
  const [adminInviteEmail, setAdminInviteEmail] =
    useQueryState("admin-invite-email");
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);
  const redeemInvite = useRedeemAdminInvite();

  const triggerRedeem = useCallback(async () => {
    if (adminInviteToken) {
      await redeemInvite.mutateAsync({
        adminInviteToken,
      });
      setAdminInviteToken(null);
      setAdminInviteEmail(null);
    }
  }, [
    adminInviteToken,
    redeemInvite,
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
        signOut().then(() => setShowSignUpDialog(true));
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
