"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { useSubscription } from "@/hooks/use-subscription";
import { useCallback, useEffect, useRef, useState } from "react";

export function Plan() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [canPoll, setCanPoll] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const {
    query: { data: polarProducts },
  } = usePolarProducts();

  const {
    query: { data: subscription },
  } = useSubscription({ isPolling });

  const createPolarCheckoutSession = useCreatePolarCheckoutSession();

  const createPolarCustomerSession = useCreatePolarCustomerSession();

  const stopPolling = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setIsPolling(false);
  }, [setIsPolling]);

  const startPolling = useCallback(() => {
    if (canPoll) {
      stopPolling();
      setIsPolling(true);
      timeoutRef.current = setTimeout(() => {
        setCanPoll(false);
        stopPolling();
      }, 60000);
    }
  }, [setIsPolling, stopPolling, canPoll]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startPolling, stopPolling]);

  const handleUpgradeClick = async () => {
    if (!polarProducts) return;

    const { url } = await createPolarCheckoutSession.mutateAsync({
      polarProductIds: polarProducts.map((product) => product.id),
    });

    setCanPoll(true);

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleManageOnClick = async () => {
    const { customerPortalUrl } =
      await createPolarCustomerSession.mutateAsync();

    setCanPoll(true);

    window.open(customerPortalUrl, "_blank", "noopener,noreferrer");
  };

  const hasActiveSubscription =
    subscription && subscription.status === "active";
  const hasCanceledSubscription =
    subscription && subscription.status === "canceled";
  const hasNoSubscription = !subscription;

  return (
    <div className="pt-4">
      <h2 className="h3 mb-4">Plan</h2>
      <Label className="mb-3">Your current plan</Label>
      <div className="border-border w-full max-w-80 rounded-lg border p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">Pro</h3>
          {(!subscription || subscription.status === "canceled") && (
            <Button
              variant="link"
              className="underline"
              onClick={handleUpgradeClick}
            >
              Upgrade
            </Button>
          )}
          {subscription && (
            <Button
              variant="link"
              className="underline"
              onClick={handleManageOnClick}
            >
              Manage
            </Button>
          )}
        </div>
        <div className="mb-0.5 text-lg font-normal">USD $10/month</div>
        <div className="text-muted-foreground text-xs">Billed monthly</div>
      </div>
    </div>
  );
}
