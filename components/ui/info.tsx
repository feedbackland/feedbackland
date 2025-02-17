import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BadgeInfo } from "lucide-react";

export function Info({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Alert
      variant="default"
      className="w-full max-w-md border-blue-500 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
    >
      <BadgeInfo className="!dark:text-blue-400 size-4 !text-blue-800" />
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
