"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import * as z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDarkMode } from "./hooks/use-dark-mode";
import { cn, validateUUID } from "@/lib/utils";
import { CircleCheck, InfoIcon, XCircle } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useWindowSize } from "react-use";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const formSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Feedback cannot be empty.")
    .max(1000, "Feedback must be at most 1000 characters."),
});

const DEFAULT_BOARD_DOMAIN = "feedbackland.com";
const DEFAULT_API_ENDPOINT = "https://api.feedbackland.com/api/feedback/create";
const STATUS_RESET_DELAY_MS = 100;

export const PopoverWidget = memo(
  ({
    platformId,
    url,
    children,
  }: {
    platformId: string;
    url?: string;
    children: React.ReactNode;
  }) => {
    const [isPending, setIsPending] = useState(false);
    const [status, setStatus] = useState<"success" | "error" | "active">(
      "active",
    );

    const isDarkMode = useDarkMode();

    const { width } = useWindowSize();

    // Resolve URLs honoring the optional `url` prop, with dark-mode propagation.
    // Falls back to the public Feedbackland SaaS when `url` isn't provided.
    const { boardUrl, apiUrl } = useMemo(() => {
      const mode = isDarkMode ? "dark" : "light";
      let resolvedBoard: string | undefined;
      let resolvedApi: string = DEFAULT_API_ENDPOINT;

      if (url) {
        try {
          const parsed = new URL(url);
          const base = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
          resolvedBoard = `${base}?mode=${mode}`;
          resolvedApi = `${base}/api/feedback/create`;
        } catch {
          console.warn(
            "[feedbackland-react] Invalid `url` prop, ignoring:",
            url,
          );
        }
      }

      if (!resolvedBoard && platformId && validateUUID(platformId)) {
        resolvedBoard = `https://${platformId}.${DEFAULT_BOARD_DOMAIN}?mode=${mode}`;
      }

      return { boardUrl: resolvedBoard, apiUrl: resolvedApi };
    }, [platformId, url, isDarkMode]);

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        description: "",
      },
    });

    async function onSubmit(data: z.infer<typeof formSchema>) {
      const { description } = data;

      if (!description) return;

      // Reject submissions that have neither a custom URL nor a valid UUID.
      if (!url && (!platformId || !validateUUID(platformId))) {
        console.warn(
          "[feedbackland-react] Cannot submit: `platformId` is invalid and no `url` prop was provided.",
        );
        setStatus("error");
        return;
      }

      try {
        setIsPending(true);
        form.clearErrors();

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orgId: platformId,
            description,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setStatus("success");
        form.reset();
      } catch (err) {
        console.error(
          "[feedbackland-react] feedback submission failed:",
          err,
        );
        setStatus("error");
      } finally {
        setIsPending(false);
      }
    }

    // Reset to "active" shortly after the popover/drawer transitions, giving the
    // close animation time to finish so the success/error UI doesn't flicker.
    // Tracked in a ref + cleared on unmount to avoid setState-on-unmounted warnings.
    const resetTimeoutRef = useRef<number | null>(null);

    const onOpenChange = () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = window.setTimeout(() => {
        setStatus("active");
        resetTimeoutRef.current = null;
      }, STATUS_RESET_DELAY_MS);
    };

    useEffect(() => {
      return () => {
        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
          resetTimeoutRef.current = null;
        }
      };
    }, []);

    const Inner = (
      <>
        {status === "active" && (
          <div className="fl:space-y-3">
            <form id="feedback-form" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  name="description"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel
                        htmlFor="feedback-form-description"
                        className="fl:sr-only"
                      >
                        Feedback
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupTextarea
                          {...field}
                          id="feedback-form-description"
                          placeholder="Describe your idea, issue, or any other feedback..."
                          rows={6}
                          className="fl:min-h-24 fl:resize-none fl:text-primary"
                          aria-invalid={fieldState.invalid}
                        />
                      </InputGroup>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>

            <div className="fl:flex fl:items-center fl:justify-between fl:gap-6">
              <div className="fl:flex fl:items-center fl:gap-1.5 fl:text-xs fl:font-normal">
                <InfoIcon className="fl:size-3.5! fl:shrink-0" />
                <span>
                  Your input will be submitted anonymously on the{" "}
                  {boardUrl ? (
                    <a
                      href={boardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fl:underline fl:text-primary"
                    >
                      feedback board
                    </a>
                  ) : (
                    <span className="fl:underline">feedback board</span>
                  )}
                </span>
              </div>
              <Button
                size="sm"
                type="submit"
                form="feedback-form"
                className=""
                loading={isPending}
              >
                Submit feedback
              </Button>
            </div>
          </div>
        )}

        {status === "success" && (
          <div
            role="status"
            aria-live="polite"
            className="fl:flex fl:flex-col fl:items-stretch fl:text-center fl:px-6 fl:py-6"
          >
            <CircleCheck className="fl: fl:mx-auto fl:size-8! fl:shrink-0 fl:mb-3 fl:text-green-700" />
            <div className="fl:text-base fl:font-semibold fl:mb-2">
              Feedback received. Thank you!
            </div>
            {boardUrl && (
              <a
                href={boardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="fl:underline fl:text-sm fl:font-normal"
              >
                Visit the feedback board
              </a>
            )}
          </div>
        )}

        {status === "error" && (
          <div
            role="alert"
            aria-live="assertive"
            className="fl:flex fl:flex-col fl:items-stretch fl:text-center fl:px-6 fl:py-6"
          >
            <XCircle className="fl: fl:mx-auto fl:size-8! fl:shrink-0 fl:mb-3 fl:text-red-700" />
            <div className="fl:text-base fl:font-semibold fl:mb-2">
              Something went wrong
            </div>
            <div className="fl:text-sm fl:font-normal">
              Your feedback could not be sent. Please try again later.
            </div>
          </div>
        )}
      </>
    );

    let component = (
      <Drawer onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="fl-scope fl:p-4">
          <DrawerHeader className="fl:sr-only">
            <DrawerTitle>Submit your feedback</DrawerTitle>
            <DrawerDescription>
              Describe your idea, issue, or any other feedback below.
            </DrawerDescription>
          </DrawerHeader>
          {Inner}
        </DrawerContent>
      </Drawer>
    );

    if (width > 768) {
      component = (
        <Popover onOpenChange={onOpenChange}>
          <PopoverTrigger asChild className={cn("", { dark: isDarkMode })}>
            {children}
          </PopoverTrigger>
          <PopoverContent
            className={cn("fl-scope fl:w-[400px]", { dark: isDarkMode })}
          >
            {Inner}
          </PopoverContent>
        </Popover>
      );
    }

    return component;
  },
);

PopoverWidget.displayName = "PopoverWidget";
