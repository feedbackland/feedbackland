"use client";

import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export function PlatformHeaderDescription({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const pathname = usePathname();
  const isAdminPage = pathname.includes("/admin");

  const settings = useSettings();

  if (
    !isAdminPage &&
    settings?.platformDescription &&
    settings?.platformDescription?.length > 0
  ) {
    return (
      <div
        className={cn("text-muted-foreground text-sm font-normal", className)}
      >
        {settings.platformDescription}
      </div>
    );
  }

  return null;
}
