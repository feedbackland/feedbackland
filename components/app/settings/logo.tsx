"use client";
import { useEffect, useState, useRef } from "react";
import { ImageCropper } from "@/components/ui/image-cropper";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { useSettings } from "@/hooks/use-settings";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import {
  checkImageSource,
  uploadEditorImage,
  uploadHelp,
} from "@/components/ui/minimal-tiptap/upload";
import { Button } from "@/components/ui/button";
import Image from "next/image";
export function Logo() {
  const { query } = useAdminSettings(),
    { capabilities } = useSettings(),
    update = useUpdateSettings();
  const [draft, setDraft] = useState<{ url: string; revision: string } | null>(
    null,
  );
  const selection = useRef(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (draft) URL.revokeObjectURL(draft.url);
    },
    [draft],
  );
  if (!query.data) return null;
  const { logoImageId, revision } = query.data;
  async function save(file: Blob) {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const { id } = await uploadEditorImage(
        new File([file], "logo.png", { type: "image/png" }),
        capabilities.maxImageBytes,
      );
      await update.mutateAsync({
        logoImageId: id,
        expectedRevision: draft.revision,
      });
    } catch {
      setError(
        "Could not save the logo. Check the upload limit and current settings, then try again.",
      );
    } finally {
      setDraft(null);
      setBusy(false);
    }
  }
  return (
    <section className="my-6 space-y-2">
      <h3 className="font-medium">Board logo</h3>
      {logoImageId && (
        <Image
          src={"/api/images/" + logoImageId}
          alt="Current board logo"
          width={60}
          height={60}
        />
      )}
      <label className="block">
        Choose a logo{" "}
        <input
          type="file"
          accept="image/*"
          disabled={busy || update.isPending}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const current = ++selection.current;
            try {
              await checkImageSource(file);
              if (current === selection.current) {
                setError("");
                setDraft({ url: URL.createObjectURL(file), revision });
              }
            } catch (error) {
              if (current === selection.current)
                setError(
                  error instanceof Error
                    ? error.message
                    : "Unable to read image.",
                );
            }
          }}
        />
      </label>
      {logoImageId && (
        <Button
          type="button"
          variant="outline"
          disabled={busy || update.isPending}
          onClick={() => {
            setError("");
            update.mutate(
              { logoImageId: null, expectedRevision: revision },
              {
                onError: () =>
                  setError("Could not remove the logo. Refresh and try again."),
              },
            );
          }}
        >
          Remove logo
        </Button>
      )}
      <p className="text-muted-foreground text-xs">{uploadHelp}</p>
      {error && <p role="alert">{error}</p>}
      {draft && (
        <ImageCropper
          open
          imageSrc={draft.url}
          onClose={() => setDraft(null)}
          onCrop={save}
        />
      )}
    </section>
  );
}
