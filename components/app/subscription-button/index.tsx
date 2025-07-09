"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { useSubscription } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";
import { Edit2Icon } from "lucide-react";

export function SubscriptionButton({
  variant = "default",
  size = "default",
  className = "",
  buttonText = "Upgrade",
}: {
  variant?: "default" | "secondary" | "outline" | "link" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: React.ComponentProps<"div">["className"];
  buttonText?: string;
}) {
  const { isAdmin } = useAuth();

  const {
    query: { data: subscription, isPending: isSubscriptionPending },
  } = useSubscription();

  const {
    query: { data: polarProducts, isPending: isPolarProductsPending },
  } = usePolarProducts();

  const createPolarCustomerSession = useCreatePolarCustomerSession();

  const createPolarCheckoutSession = useCreatePolarCheckoutSession();

  const isPending = !!(isSubscriptionPending || isPolarProductsPending);

  const polarProductIds = polarProducts?.map((product) => product.id);

  const openCheckout = async () => {
    if (!polarProductIds || polarProductIds.length === 0) return;

    const newTab = window.open("", "_blank");

    const { url: checkoutUrl } = await createPolarCheckoutSession.mutateAsync({
      polarProductIds,
    });

    if (newTab) newTab.location.href = checkoutUrl;
  };

  const openCustomerPortal = async () => {
    const newTab = window.open("", "_blank");

    const { customerPortalUrl } =
      await createPolarCustomerSession.mutateAsync();

    if (newTab) newTab.location.href = customerPortalUrl;
  };

  const handleOnClick = () => {
    if (!isPending) {
      if (subscription?.name !== "free") {
        openCustomerPortal();
      } else {
        openCheckout();
      }
    }
  };

  if (isAdmin) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn("", className)}
        onClick={handleOnClick}
      >
        {buttonText === "Manage" && <Edit2Icon />}
        {buttonText}
      </Button>
    );
  }
}
