"use client";

import { useEffect, useRef } from "react";
import { ref, onValue } from "firebase/database";
import { app } from "@/lib/firebase/client";
import { getDatabase } from "firebase/database";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export const SubscriptionListenerInner = () => {
  const queryClient = useQueryClient();

  const hasLoadedInitialData = useRef(false);

  const { isAdmin } = useAuth();

  const {
    query: { data: org },
  } = useOrg();

  useEffect(() => {
    hasLoadedInitialData.current = false;

    if (!org || !isAdmin) return;

    const db = getDatabase(app);

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
