"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    refetch().then(({ data }) => {
      setSubscription(data || null);
    });
  }, [refetch]);

  useEffect(() => {
    if (!org) return;

    const subscriptionRef = ref(db, `subscriptions/${org.id}`);

    const unsubscribe = onValue(subscriptionRef, () => {
      refetch().then(({ data }) => {
        setSubscription(data || null);
      });
    });

    return () => {
      off(subscriptionRef, "value", unsubscribe);
    };
  }, [org, refetch]);

  return { subscription };
}
