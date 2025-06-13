"use client";

import { Button } from "@/components/ui/button";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { useSubscriptionChange } from "@/hooks/use-subscription-change";
import { Badge } from "@/components/ui/badge";

export function Plan() {
  const {
    query: { data: polarProducts },
  } = usePolarProducts();
  const { subscription, isPending } = useSubscriptionChange();
  const createPolarCheckoutSession = useCreatePolarCheckoutSession();
  const createPolarCustomerSession = useCreatePolarCustomerSession();

  const polarProductIds = polarProducts?.map((product) => product.id);

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

  const hasSubscription = !!subscription;
  const isActive = !subscription?.isExpired;
  const isExpired = !!(subscription && subscription.isExpired);

  if (!isPending) {
    return (
      <div className="">
        <h2 className="h4 mb-6">Plan</h2>
        <div className="border-border flex w-full max-w-[350px] flex-col items-stretch space-y-4 rounded-lg border p-4 shadow-sm">
          <div className="">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold capitalize">
                  {subscription?.name || "Free"}
                </h3>
                <div className="-mt-1 -mr-1">
                  {hasSubscription ? (
                    <Button
                      variant="link"
                      className="underline"
                      onClick={handleManageOnClick}
                    >
                      {isActive ? "Manage" : "Renew"}
                    </Button>
                  ) : (
                    <Button
                      variant="link"
                      className="underline"
                      onClick={handleUpgradeClick}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {isExpired && <Badge variant="destructive">Expired</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch">
            <div className="mb-0.5 flex items-end">
              <span className="text-2xl font-semibold">
                ${subscription?.amount || 0}
              </span>
              <span className="mb-0.5 text-sm font-normal">
                /{subscription?.frequency || "month"}
              </span>
            </div>
            {subscription && (
              <div className="text-muted-foreground text-xs">
                {subscription.frequency === "month" && "Billed monthly"}
                {subscription.frequency === "year" && "Billed annually"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
