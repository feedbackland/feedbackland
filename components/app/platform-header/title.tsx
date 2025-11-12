"use client";

import Link from "next/link";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useOrg } from "@/hooks/use-org";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function PlatformHeaderTitle({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();

  const {
    query: { data: orgData, isPending },
  } = useOrg();

  return (
    <div className={cn("w-full", className)}>
      {isPending ? (
        <Skeleton className="h-[24px] w-full max-w-[192px]" />
      ) : (
        <h1 className="text-xl font-bold tracking-tight">
          <Link
            href={`${platformUrl}`}
            className="flex items-center gap-2 focus-visible:outline-none"
          >
            {orgData?.logo && (
              <Image
                src={orgData.logo}
                alt="logo"
                width={30}
                height={30}
                className="size-[30px] rounded-sm object-contain"
              />
            )}
            <span>{orgData?.platformTitle || "Feedback board"}</span>
          </Link>
        </h1>
      )}
    </div>
  );
}
