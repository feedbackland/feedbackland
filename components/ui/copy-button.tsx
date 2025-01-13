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
      // variant="ghost"
      onClick={handleCopy}
      className={cn("text-secondary", isCopied && "text-green-500", className)}
    >
      {isCopied ? <Check /> : <Copy />}
    </Button>
  );
};
