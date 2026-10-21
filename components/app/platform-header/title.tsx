"use client";

import Link from "next/link";
import { useBoardHref } from "@/hooks/use-board-href";
import { useSettings } from "@/hooks/use-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function PlatformHeaderTitle({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const href = useBoardHref();

  const settings = useSettings();
  const isPending = false;

  return (
    <div className={cn("w-full", className)}>
      {isPending ? (
        <Skeleton className="h-[24px] w-full max-w-[192px]" />
      ) : (
        <h1 className="text-xl font-bold tracking-tight">
          <Link
            href={href(`/`)}
            className="flex items-center gap-2 focus-visible:outline-none"
          >
            {settings?.logoUrl && (
              <Image
                src={settings.logoUrl}
                alt="logo"
                width={30}
                height={30}
                className="size-[30px] rounded-sm object-contain"
              />
            )}
            <span>{settings?.platformTitle || "Feedback board"}</span>
          </Link>
        </h1>
      )}
    </div>
  );
}
