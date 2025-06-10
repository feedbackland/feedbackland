"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { useSubscriptionChange } from "@/hooks/use-subscription-change";

export function Plan() {
  const {
    query: { data: polarProducts },
  } = usePolarProducts();

  const { subscription } = useSubscriptionChange();

  const createPolarCheckoutSession = useCreatePolarCheckoutSession();

  const createPolarCustomerSession = useCreatePolarCustomerSession();

  console.log("polarProducts", polarProducts);
  console.log("subscription", subscription);

  const handleUpgradeClick = async () => {
    if (!polarProducts) return;

    const { url: checkoutUrl } = await createPolarCheckoutSession.mutateAsync({
      polarProductIds: polarProducts.map((product) => product.id),
    });

    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
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
