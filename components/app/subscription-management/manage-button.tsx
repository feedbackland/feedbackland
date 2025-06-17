"use client";

import { Button } from "@/components/ui/button";
import { useCreatePolarCustomerSession } from "@/hooks/use-create-polar-customer-session";
import { cn } from "@/lib/utils";

export function SubscriptionManagementButton({
  variant = "default",
  className = "",
  buttonText = "Manage",
}: {
  variant?: "default" | "secondary" | "outline" | "link" | "ghost";
  className?: React.ComponentProps<"div">["className"];
  buttonText?: string;
}) {
  const createPolarCustomerSession = useCreatePolarCustomerSession();

  const handleOnClick = async () => {
    const { customerPortalUrl } =
      await createPolarCustomerSession.mutateAsync();
    window.open(customerPortalUrl, "_blank", "noopener,noreferrer");
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
