"use client";

import { useAuth } from "@/hooks/use-auth";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";
import { SubscriptionListenerInner } from "./inner";
// import dynamic from "next/dynamic";

// const SubscriptionListenerInner = dynamic(
//   () =>
//     import("./inner").then(
//       ({ SubscriptionListenerInner }) => SubscriptionListenerInner,
//     ),
//   {
//     ssr: false,
//   },
// );

export const SubscriptionListener = () => {
  const isSelfHosted = useIsSelfHosted();
  const { isAdmin } = useAuth();

  if (isAdmin && !isSelfHosted) {
    return <SubscriptionListenerInner />;
  }

  return null;
};
