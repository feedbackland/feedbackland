import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";

export function Error({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Alert
      variant="default"
      className="w-full max-w-md border-red-500 bg-red-50 dark:border-red-900 dark:bg-red-950"
    >
      <TriangleAlert className="!dark:text-red-400 size-4 !text-red-800" />
      <AlertTitle className="mt-1 text-red-800 dark:text-red-400">
        {title}
      </AlertTitle>
      {description && (
        <AlertDescription className="text-red-800 dark:text-red-400">
          {description}
        </AlertDescription>
      )}
    </Alert>
  );
}
