"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/app/feedback-form/form";
import { FeedbackFormBanner } from "@/components/app/feedback-form/banner";

export function FeedbackFormContainer() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      {!isFormOpen ? (
        <FeedbackFormBanner
          bannerText="Have an idea for a new feature or improvement? Type it here..."
          buttonText="Share your idea"
          onClick={() => setIsFormOpen(true)}
        />
      ) : (
        <FeedbackForm onClose={() => setIsFormOpen(false)} />
      )}
    </>
  );
}
