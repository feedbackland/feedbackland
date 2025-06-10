"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { Subscriptions } from "@/db/schema";
import { Selectable } from "kysely";
import { useOrg } from "@/hooks/use-org";

type Subscription = Selectable<Subscriptions> | null;

export function useSubscriptionChange() {
  const {
    query: { data: org },
  } = useOrg();

  const {
    query: { refetch },
  } = useSubscription();

  const [subscription, setSubscription] = useState<Subscription>(null);
  const [isPending, setIsPending] = useState(true);

  const getSubscription = useCallback(async () => {
    try {
      setIsPending(true);
      const { data } = await refetch();
      setSubscription(data || null);
    } catch {
      setSubscription(null);
    } finally {
      setIsPending(false);
    }
  }, [setIsPending, refetch]);

  useEffect(() => {
    getSubscription();
  }, [getSubscription]);

  useEffect(() => {
    if (!org) return;

    const subscriptionRef = ref(db, `subscriptions/${org.id}`);

    const unsubscribe = onValue(subscriptionRef, () => {
      console.log("zolg");
      getSubscription();
    });

    return () => {
      off(subscriptionRef, "value", unsubscribe);
    };
  }, [org, getSubscription]);

  return { subscription, isPending };
}
