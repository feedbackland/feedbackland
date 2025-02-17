import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export function Success({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Alert
      variant="default"
      className="w-full max-w-md border-green-500 bg-green-50 dark:border-green-900 dark:bg-green-950"
    >
      <CheckCircle2 className="!dark:text-green-400 size-4 !text-green-800" />
      <AlertTitle className="mt-1 text-green-800 dark:text-green-400">
        {title}
      </AlertTitle>
      {description && (
        <AlertDescription className="text-green-800 dark:text-green-400">
          {description}
        </AlertDescription>
      )}
    </Alert>
  );
}
