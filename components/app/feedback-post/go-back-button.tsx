"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { previousPathnameAtom } from "@/lib/atoms";
import { useAtomValue } from "jotai";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const GoBackButton = ({
  className,
  label,
}: {
  className?: React.ComponentProps<"div">["className"];
  /**
   * Word shown beside the arrow, where there is room for one. The drawer panel
   * is tight enough that the arrow has to earn its place alone and explain
   * itself on hover; the board page has room to just say what the control does.
   */
  label?: string;
}) => {
  const router = useRouter();
  const platformUrl = usePlatformUrl();
  const previousPathname = useAtomValue(previousPathnameAtom);

  const handleGoBack = () => {
    if (previousPathname && window.history.length > 1) {
      window.history.go(-1);
    } else if (platformUrl) {
      router.push(platformUrl);
    }
  };

  const button = (
    <Button
      size={label ? "sm" : "icon"}
      onClick={handleGoBack}
      variant="link"
      className={cn(
        "text-muted-foreground hover:text-primary hover:no-underline",
        // Unlabelled, the control is exactly the glyph. Labelled, it keeps the
        // taller `sm` hit area but pulls that size's left padding back off, so
        // the arrow still starts on the page's own left edge instead of a step
        // inside it — the alignment is what makes it read as page navigation
        // rather than as something floating above the post.
        label ? "group -ml-3" : "size-fit p-0",
        className,
      )}
    >
      <ArrowLeft
        className={cn(
          // `translate-none`, not `transform-none`: the utility sets the
          // standalone `translate` property, which a cleared `transform` leaves
          // untouched — so the reduced-motion opt-out has to clear the same one.
          label &&
            "transition-transform group-hover:-translate-x-0.5 motion-reduce:translate-none",
        )}
      />
      {label}
    </Button>
  );

  // A tooltip that only repeats a word already on screen is noise, so the hint
  // is kept for the form that has no words of its own.
  if (label) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>Go back</TooltipContent>
    </Tooltip>
  );
};
