"use client";

import { useEffect, useState } from "react";
import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackFormBanner } from "@/components/app/feedback-form/banner";
import { useQueryState } from "nuqs";

export function FeedbackFormContainer() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [openForm, setOpenForm] = useQueryState("open-form", {
    parse: (value) => value === "true", // Convert query string to boolean
    serialize: (value) => (value ? "true" : "false"), // Convert boolean to string
  });

  useEffect(() => {
    if (openForm) {
      setIsFormOpen(true);
      setOpenForm(null);
    }
  }, [openForm, setOpenForm, setIsFormOpen]);

  return (
    <>
      {!isFormOpen ? (
        <FeedbackFormBanner onClick={() => setIsFormOpen(true)} />
      ) : (
        <FeedbackForm
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => setIsFormOpen(false)}
        />
      )}
    </>
  );
}
