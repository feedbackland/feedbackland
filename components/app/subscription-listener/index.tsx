"use client";

import { useEffect } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase/client";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function SubscriptionListener() {
  const queryClient = useQueryClient();

  const { session } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";

  const {
    query: { data: org },
  } = useOrg();

  useEffect(() => {
    if (!org || !isAdmin) return;

    const subscriptionRef = ref(db, `subscriptions/${org.id}`);

    const unsubscribe = onValue(subscriptionRef, () => {
      queryClient.invalidateQueries();
    });

    return () => {
      off(subscriptionRef, "value", unsubscribe);
    };
  }, [org, isAdmin, queryClient]);

  return null;
}
