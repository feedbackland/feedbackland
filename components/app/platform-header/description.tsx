"use client";

import { usePathname } from "next/navigation";
import { useOrg } from "@/hooks/use-org";
import { cn } from "@/lib/utils";

export function PlatformHeaderDescription({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const pathname = usePathname();
  const isAdminPage = pathname.includes("/admin");

  const {
    query: { data: orgData },
  } = useOrg();

  if (
    !isAdminPage &&
    orgData?.platformDescription &&
    orgData?.platformDescription?.length > 0
  ) {
    return (
      <div
        className={cn("text-muted-foreground text-sm font-normal", className)}
      >
        {orgData.platformDescription}
      </div>
    );
  }

  return null;
}
