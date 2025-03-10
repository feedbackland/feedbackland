"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { cn, processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Error } from "@/components/ui/error";

export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();

  const [value, setValue] = useState("");
  const [errorMessage, setErrormessage] = useState("");

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

  const onSubmit = async () => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter some feedback.");
      return;
    }

    const processedDescription = await processImagesInHTML(value);

    saveFeedback.mutate({
      description: processedDescription,
    });
  };

  const saveFeedback = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess: () => {
        setValue("");
      },
      onError: () => {
        setErrormessage("Something went wrong. Please try again.");
      },
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Tiptap
          placeholder={`Share your feature request, bug report, or any other feedback...`}
          value={value}
          onChange={onChange}
          className={cn("min-h-32 shadow-none")}
          showToolbar={true}
          autofocus={true}
        />
        <div className="absolute bottom-2 right-2 flex flex-row-reverse justify-end gap-3">
          <Button
            type="submit"
            size="sm"
            loading={saveFeedback.isPending}
            onClick={onSubmit}
            className="order-1"
          >
            <SendIcon className="size-3" />
            Submit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onClose}
            className="order-2"
          >
            Cancel
          </Button>
        </div>
      </div>
      {errorMessage.length > 0 && <Error title={errorMessage} />}
    </div>
  );
}
