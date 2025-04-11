import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Error({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <Alert variant="destructive" className={cn("", className)}>
      <AlertTriangle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  );
}
