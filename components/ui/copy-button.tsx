"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

export const CopyButton = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (error) {
      console.error("Failed to copy text: ", error);
    }
  };

  return (
    <Button
      size="icon"
      variant="default"
      onClick={handleCopy}
      className={cn(
        "size-7 text-primary-foreground hover:bg-muted/20",
        className,
      )}
    >
      {isCopied ? (
        <Check className="!size-3.5" />
      ) : (
        <Copy className="!size-3.5" />
      )}
    </Button>
  );
};
