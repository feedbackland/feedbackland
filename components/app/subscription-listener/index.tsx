"use client";

import { useEffect, useRef } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase/client";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const SubscriptionListenerInner = () => {
  const queryClient = useQueryClient();

  const hasLoadedInitialData = useRef(false);

  const { isAdmin } = useAuth();

  const {
    query: { data: org },
  } = useOrg();

  useEffect(() => {
    hasLoadedInitialData.current = false;

    if (!org || !isAdmin) return;

    const subscriptionRef = ref(db, `subscriptions/${org.id}`);

    const unsubscribe = onValue(subscriptionRef, () => {
      if (!hasLoadedInitialData.current) {
        hasLoadedInitialData.current = true;
        return;
      }

      queryClient.invalidateQueries();
    });

    return () => {
      unsubscribe();
      hasLoadedInitialData.current = false;
    };
  }, [org, isAdmin, queryClient]);

  return null;
};

export const SubscriptionListener = () => {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return <SubscriptionListenerInner />;
  }

  return null;
};

SubscriptionListener.displayName = "SubscriptionListener";
