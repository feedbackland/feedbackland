"use client";

import { useEffect, memo, useRef } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase/client";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export const SubscriptionListener = memo(() => {
  const queryClient = useQueryClient();
  const hasLoadedInitialData = useRef(false);

  const { session } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";

  const {
    query: { data: org },
  } = useOrg();

  useEffect(() => {
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
      off(subscriptionRef, "value", unsubscribe);
    };
  }, [org, isAdmin, queryClient]);

  return null;
});

SubscriptionListener.displayName = "SubscriptionListener";
