"use client";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import { Switch } from "@/components/ui/switch";
export function Indexing() {
  const {
    query: { data },
  } = useAdminSettings();
  const mutation = useUpdateSettings();
  return (
    <div className="mt-8 space-y-2">
      <label htmlFor="allow-indexing" className="flex items-center gap-3">
        <Switch
          id="allow-indexing"
          checked={data?.allowIndexing ?? false}
          disabled={!data || mutation.isPending}
          onCheckedChange={(allowIndexing) => {
            if (data)
              mutation.mutate({
                expectedRevision: data.revision,
                allowIndexing,
              });
          }}
        />
        Allow search engines to index the public board
      </label>
      <p className="text-muted-foreground text-sm">
        Embedded boards and private pages always discourage indexing.
      </p>
      {mutation.isError && (
        <p role="alert">Could not save indexing settings. Please try again.</p>
      )}
    </div>
  );
}
