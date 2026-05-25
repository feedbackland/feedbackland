"use client";

import * as React from "react";
import "./index.css";
import { OverlayWidget } from "./OverlayWidget";
import { PopoverWidget } from "./PopoverWidget";
import { Button } from "./components/ui/button";
import { type ClassValue } from "clsx";
import { cn } from "@/lib/utils";

type StyledVariant =
  | "default"
  | "link"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary";

type Variant = StyledVariant | "unstyled";

type Size = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

type FeedbackButtonProps = {
  platformId: string;
  url?: string;
  widget?: "drawer" | "popover";
  text?: string;
  variant?: Variant;
  size?: Size;
  className?: ClassValue;
  asChild?: boolean;
  children?: React.ReactNode;
};

export const FeedbackButton = ({
  platformId,
  url,
  widget = "drawer",
  text = "Feedback",
  variant = "default",
  size = "default",
  className,
  asChild = false,
  children,
}: FeedbackButtonProps) => {
  const content = children ?? text;

  let trigger: React.ReactNode;
  if (asChild && children) {
    // Bring-your-own-button: the child is used as the trigger unchanged.
    // The widget below wires the open handler via Radix asChild (Popover /
    // Drawer triggers) or a wrapping click handler (Overlay), so the host's
    // own button keeps its onClick, ref, refs, etc.
    trigger = children;
  } else if (variant === "unstyled") {
    // Widget's <button> element, no internal styling. Consumer's className
    // is the only source of visual rules.
    trigger = (
      <button type="button" className={cn(className)}>
        {content}
      </button>
    );
  } else {
    // Default: styled internal Button.
    trigger = (
      <Button variant={variant} size={size} className={cn("", className)}>
        {content}
      </Button>
    );
  }

  const inner =
    widget === "popover" ? (
      <PopoverWidget platformId={platformId} url={url}>
        {trigger}
      </PopoverWidget>
    ) : (
      <OverlayWidget platformId={platformId} url={url}>
        {trigger}
      </OverlayWidget>
    );

  // Only wrap the trigger in .fl-scope when it depends on the widget's
  // CSS variables and reset (i.e., the default styled Button). For asChild
  // and "unstyled", the trigger lives in the host's own typographic and
  // box-model context. The widget's portal/panel carries its own .fl-scope
  // internally, so panel rendering is unaffected.
  const needsScope = !asChild && variant !== "unstyled";

  return needsScope ? <div className="fl-scope">{inner}</div> : <>{inner}</>;
};

FeedbackButton.displayName = "FeedbackButton";
