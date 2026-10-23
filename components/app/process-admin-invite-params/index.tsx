"use client";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useCallback } from "react";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useRedeemAdminInvite } from "@/hooks/use-redeem-admin-invite";
import { useAdminInvite } from "@/hooks/use-admin-invite";

export function ProcessAdminInviteParams() {
  const { authAvailable } = useAuth();
  const [token, setToken] = useQueryState("admin-invite-token");
  const [email, setEmail] = useQueryState("admin-invite-email");
  const close = useCallback(() => {
    void setToken(null);
    void setEmail(null);
  }, [setToken, setEmail]);
  if (!authAvailable || !token || !email) return null;
  return (
    <InviteFlow
      key={`${token}:${email}`}
      token={token}
      email={email}
      onClose={close}
    />
  );
}
function InviteFlow({
  token,
  email,
  onClose,
}: {
  token: string;
  email: string;
  onClose: () => void;
}) {
  const { session, isLoaded, signOut, refreshSession } = useAuth();
  const { query } = useAdminInvite({ adminInviteToken: token });
  const { mutate } = useRedeemAdminInvite();
  const redeeming = useRef(false),
    signingOut = useRef(false);
  const redeem = useCallback(() => {
    if (redeeming.current) return;
    redeeming.current = true;
    mutate(
      { adminInviteToken: token },
      {
        onSuccess() {
          refreshSession();
          onClose();
        },
        onError: onClose,
      },
    );
  }, [mutate, token, refreshSession, onClose]);
  useEffect(() => {
    if (!isLoaded || !query.isSuccess || !session) return;
    if (session.user.email.toLowerCase() === email.toLowerCase()) redeem();
    else if (!signingOut.current) {
      signingOut.current = true;
      void signOut().catch(onClose);
    }
  }, [isLoaded, query.isSuccess, session, email, redeem, signOut, onClose]);
  if (query.isError)
    return (
      <p role="alert">
        This invitation cannot be opened.{" "}
        <button onClick={onClose}>Dismiss</button>
      </p>
    );
  return (
    <SignUpInDialog
      open={isLoaded && query.isSuccess && !session}
      initialSelectedMethod="sign-up"
      onClose={onClose}
      onSuccess={redeem}
    />
  );
}
