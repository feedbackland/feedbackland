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
    <Alert
      variant="default"
      className={cn(
        "w-full border-blue-800 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
        className,
      )}
    >
      <BadgeInfo className="!dark:text-blue-400 size-4 text-blue-800!" />
      <AlertTitle className="mt-1 text-blue-800 dark:text-blue-400">
        {title}
      </AlertTitle>
      {description && (
        <AlertDescription className="text-blue-800 dark:text-blue-400">
          {description}
        </AlertDescription>
      )}
    </Alert>
  );
}
