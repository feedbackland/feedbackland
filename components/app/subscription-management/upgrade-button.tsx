"use client";

import { Button } from "@/components/ui/button";
import { useCreatePolarCheckoutSession } from "@/hooks/use-create-polar-checkout-session";
import { usePolarProducts } from "@/hooks/use-polar-products";
import { cn } from "@/lib/utils";

export function SubscriptionUpgradeButton({
  variant = "default",
  className = "",
  buttonText = "Upgrade",
}: {
  variant?: "default" | "secondary" | "outline" | "link" | "ghost";
  className?: React.ComponentProps<"div">["className"];
  buttonText?: string;
}) {
  const {
    query: { data: polarProducts },
  } = usePolarProducts();

  const createPolarCheckoutSession = useCreatePolarCheckoutSession();

  const polarProductIds = polarProducts?.map((product) => product.id);

  const handleOnClick = async () => {
    if (!polarProductIds || polarProductIds.length === 0) return;

    const { url: checkoutUrl } = await createPolarCheckoutSession.mutateAsync({
      polarProductIds,
    });

    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      variant={variant}
      className={cn("", className)}
      onClick={handleOnClick}
    >
      {buttonText}
    </Button>
  );
}
