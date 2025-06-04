"use client";

import { useQueryState } from "nuqs";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState } from "react";
import { useRedeemAdminInvite } from "@/hooks/use-redeem-admin-invite";
import { useAdminInvite } from "@/hooks/use-admin-invite";

export function ProcessAdminInviteParams() {
  const { session, isLoaded: isAuthLoaded, signOut } = useAuth();
  const [adminInviteToken, setAdminInviteToken] =
    useQueryState("admin-invite-token");
  const [adminInviteEmail, setAdminInviteEmail] =
    useQueryState("admin-invite-email");
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);
  const redeemInvite = useRedeemAdminInvite();
  const {
    query: { isSuccess: isAdminInviteSuccess, isError: isAdminInviteError },
  } = useAdminInvite({ adminInviteToken });

  const handleOnClose = useCallback(() => {
    setShowSignUpDialog(false);
    setAdminInviteToken(null);
    setAdminInviteEmail(null);
  }, [setShowSignUpDialog, setAdminInviteToken, setAdminInviteEmail]);

  const redeem = useCallback(() => {
    if (adminInviteToken) {
      redeemInvite.mutate(
        {
          adminInviteToken,
        },
        {
          onSuccess: () => {
            handleOnClose();
            window.location.reload();
          },
          onError: () => {
            handleOnClose();
          },
        },
      );
    }
  }, [adminInviteToken, redeemInvite, handleOnClose]);

  useEffect(() => {
    if (isAdminInviteError) {
      handleOnClose();
    }
  }, [isAdminInviteError, handleOnClose]);

  useEffect(() => {
    if (
      isAuthLoaded &&
      isAdminInviteSuccess &&
      adminInviteToken &&
      adminInviteEmail &&
      redeemInvite.isIdle &&
      !redeemInvite.isPending &&
      !redeemInvite.isError &&
      !redeemInvite.isSuccess
    ) {
      if (!session) {
        setShowSignUpDialog(true);
      } else if (session && session.user.email === adminInviteEmail) {
        redeem();
      } else if (session && session.user.email !== adminInviteEmail) {
        signOut();
      }
    }
  }, [
    session,
    isAuthLoaded,
    isAdminInviteSuccess,
    adminInviteToken,
    adminInviteEmail,
    redeemInvite,
    redeem,
    signOut,
  ]);

  return (
    <SignUpInDialog
      open={showSignUpDialog}
      initialSelectedMethod="sign-up"
      onClose={handleOnClose}
      onSuccess={redeem}
    />
  );
}
