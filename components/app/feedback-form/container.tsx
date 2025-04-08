"use client";

import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackFormBanner } from "@/components/app/feedback-form/banner";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";

export function FeedbackFormContainer() {
  const [isOpen, setIsOpen] = useState(false);

  const [isFeedbackFormOpened, setIsFeedbackFormOpened] = useQueryState(
    "feedback-form-opened",
  );

  useEffect(() => {
    if (isFeedbackFormOpened) {
      setIsFeedbackFormOpened(null);
      setIsOpen(true);
    }
  }, [isFeedbackFormOpened, setIsFeedbackFormOpened]);

  return (
    <>
      {!isOpen ? (
        <FeedbackFormBanner onClick={() => setIsOpen(true)} />
      ) : (
        <FeedbackForm
          onClose={() => setIsOpen(false)}
          onSuccess={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
