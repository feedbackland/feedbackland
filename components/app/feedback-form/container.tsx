"use client";

import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackFormBanner } from "@/components/app/feedback-form/banner";
import { isFeedbackFormOpenAtom } from "@/lib/atoms";
import { useAtom } from "jotai";

export function FeedbackFormContainer() {
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useAtom(
    isFeedbackFormOpenAtom,
  );

  // return (
  //   <FeedbackForm
  //     onClose={() => setIsFeedbackFormOpen(false)}
  //     onSuccess={() => setIsFeedbackFormOpen(false)}
  //   />
  // );

  return (
    <>
      {!isFeedbackFormOpen ? (
        <FeedbackFormBanner onClick={() => setIsFeedbackFormOpen(true)} />
      ) : (
        <FeedbackForm
          onClose={() => setIsFeedbackFormOpen(false)}
          onSuccess={() => setIsFeedbackFormOpen(false)}
        />
      )}
    </>
  );
}
