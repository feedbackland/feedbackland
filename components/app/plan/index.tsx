"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { usePolarSubscription } from "@/hooks/use-polar-subscription";
import { useEffect } from "react";

export function Plan() {
  const {
    query: { data: products },
  } = usePolarProducts();

  const {
    query: { data: subscription, refetch },
  } = usePolarSubscription();

  const createPolarCheckoutSession = useCreatePolarCheckoutSession();

  const createPolarCustomerSession = useCreatePolarCustomerSession();

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      refetch();
      const data = JSON.parse(event.data);
      console.log("event received:", data);
      // setMessage(data.text);
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
    };

    return () => {
      console.log("Closing EventSource connection.");
      eventSource.close();
    };
  }, [refetch]);

  const handleUpgradeClick = async () => {
    if (!products) return;

    const { url } = await createPolarCheckoutSession.mutateAsync({
      polarProductIds: products.map((product) => product.id),
    });

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleManageOnClick = async () => {
    const { customerPortalUrl } =
      await createPolarCustomerSession.mutateAsync();
    window.open(customerPortalUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pt-4">
      <h2 className="h3 mb-4">Plan</h2>
      <Label className="mb-3">Your current plan</Label>
      <div className="border-border w-full max-w-80 rounded-lg border p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">Pro</h3>
          <Button
            variant="link"
            className="underline"
            onClick={handleUpgradeClick}
          >
            Upgrade
          </Button>
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
