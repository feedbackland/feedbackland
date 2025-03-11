"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/app/feedback-form/form";
import { FeedbackFormBanner } from "@/components/app/feedback-form/banner";

export function FeedbackFormContainer({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [isFormOpen, setIsFormOpen] = useState(true);

  return (
    <>
      {!isFormOpen ? (
        <FeedbackFormBanner onClick={() => setIsFormOpen(true)} />
      ) : (
        <FeedbackForm
          onClose={() => setIsFormOpen(false)}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}
