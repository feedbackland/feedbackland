"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { useSubscriptionChange } from "@/hooks/use-subscription-change";

export function Plan() {
  let currentPlanName: "Free" | "Pro" | "Max" = "Free";
  let currentPlanPrice = 0;
  let currentPlanFrequency = "month";

  const {
    query: { data: polarProducts },
  } = usePolarProducts();

  const polarProductIds = polarProducts?.map((product) => product.id);

  const { subscription } = useSubscriptionChange();

  const polarProduct = polarProducts?.find(
    (product) => product.id === subscription?.productId,
  );

  const polarProductPrice = polarProduct?.prices?.[0];

  if (polarProduct?.name?.toLowerCase()?.includes("pro")) {
    currentPlanName = "Pro";
  } else if (polarProduct?.name?.toLowerCase()?.includes("max")) {
    currentPlanName = "Max";
  }

  if (polarProductPrice && "priceAmount" in polarProductPrice) {
    currentPlanPrice = Math.round(polarProductPrice?.priceAmount / 100) || 0;
  }

  if (polarProductPrice && "recurringInterval" in polarProductPrice) {
    currentPlanFrequency = polarProductPrice?.recurringInterval || "month";
  }

  const createPolarCheckoutSession = useCreatePolarCheckoutSession();

  const createPolarCustomerSession = useCreatePolarCustomerSession();

  const handleUpgradeClick = async () => {
    if (!polarProductIds || polarProductIds.length === 0) return;

    const { url: checkoutUrl } = await createPolarCheckoutSession.mutateAsync({
      polarProductIds,
    });

    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const handleManageOnClick = async () => {
    const { customerPortalUrl } =
      await createPolarCustomerSession.mutateAsync();
    window.open(customerPortalUrl, "_blank", "noopener,noreferrer");
  };

  console.log(polarProduct);

  return (
    <div className="pt-4">
      <h2 className="h3 mb-4">Plan</h2>
      <Label className="mb-3">Your current plan</Label>
      <div className="border-border w-full max-w-80 rounded-lg border p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">{currentPlanName}</h3>
          {currentPlanName === "Free" && (
            <Button
              variant="link"
              className="underline"
              onClick={handleUpgradeClick}
            >
              Upgrade
            </Button>
          )}
          {subscription && currentPlanName !== "Free" && (
            <Button
              variant="link"
              className="underline"
              onClick={handleManageOnClick}
            >
              Manage
            </Button>
          )}
        </div>
        <div className="mb-0.5 text-lg font-normal">
          ${currentPlanPrice}/{currentPlanFrequency}
        </div>
        {currentPlanName !== "Free" && (
          <div className="text-muted-foreground text-xs">
            {currentPlanFrequency === "month" && "Billed monthly"}
            {currentPlanFrequency === "year" && "Billed annually"}
          </div>
        )}
      </div>
    </div>
  );
}
