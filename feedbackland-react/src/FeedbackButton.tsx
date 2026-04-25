"use client";

import "./index.css";
import { OverlayWidget } from "./OverlayWidget";
import { PopoverWidget } from "./PopoverWidget";
import { Button } from "./components/ui/button";
import { type ClassValue } from "clsx";
import { cn } from "@/lib/utils";

export const FeedbackButton = ({
  platformId,
  url,
  widget = "drawer",
  text = "Feedback",
  variant = "default",
  size = "default",
  className,
}: {
  platformId: string;
  url?: string;
  widget?: "drawer" | "popover";
  text?: string;
  variant?:
    | "default"
    | "link"
    | "outline"
    | "ghost"
    | "destructive"
    | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: ClassValue;
}) => {
  const button = (
    <Button variant={variant} size={size} className={cn("", className)}>
      {text}
    </Button>
  );

  let component = (
    <OverlayWidget platformId={platformId} url={url}>
      {button}
    </OverlayWidget>
  );

  if (widget === "popover") {
    component = (
      <PopoverWidget platformId={platformId} url={url}>
        {button}
      </PopoverWidget>
    );
  }

  return <div className="fl-scope">{component}</div>;
};

FeedbackButton.displayName = "FeedbackButton";
