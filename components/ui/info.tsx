import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { BadgeInfo } from "lucide-react";

export function Info({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <Alert variant="default" className={cn("", className)}>
      <BadgeInfo className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  );
}
