"use client";

import { useAuth } from "@/hooks/use-auth";
import dynamic from "next/dynamic";

const SubscriptionListenerInner = dynamic(
  () =>
    import("./inner").then(
      ({ SubscriptionListenerInner }) => SubscriptionListenerInner,
    ),
  {
    ssr: false,
  },
);

export const SubscriptionListener = () => {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return <SubscriptionListenerInner />;
  }

  return null;
};
