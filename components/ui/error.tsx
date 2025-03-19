import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
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
    <Alert
      variant="default"
      className={cn(
        "w-full border-none bg-red-50 dark:border-red-900 dark:bg-red-950",
        className,
      )}
    >
      <TriangleAlert className="!dark:text-red-400 size-4 text-red-700!" />
      <AlertTitle className="text-red-700 dark:text-red-400">
        {title}
      </AlertTitle>
      {description && (
        <AlertDescription className="text-red-700 dark:text-red-400">
          {description}
        </AlertDescription>
      )}
    </Alert>
  );
}
