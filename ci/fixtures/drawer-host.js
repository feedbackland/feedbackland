import React from "react";
import { createRoot } from "react-dom/client";
import { FeedbackButton } from "feedbackland-react";
import { copyText, copyImage } from "fixture-copy";
import GlobalError from "fixture-error";
import { ImageActions } from "fixture-image-actions";
import { TooltipProvider } from "fixture-tooltip";
const params = new URLSearchParams(window.location.search);
if (params.get("fixture") === "error") {
  createRoot(document).render(React.createElement(GlobalError));
} else if (params.get("fixture") === "copy") {
  const button = React.createElement(
    "button",
    {
      onClick: async () => {
        window.fixtureResult = await copyText("Fixture text to copy");
        window.fixtureImageResult = await copyImage(
          new Blob(["fixture"], { type: "image/png" }),
        );
      },
    },
    "Copy fixture text",
  );
  createRoot(document.getElementById("root")).render(
    React.createElement(
      TooltipProvider,
      null,
      button,
      React.createElement(ImageActions, {
        isLink: true,
        onCopy() {},
        onCopyLink() {},
      }),
    ),
  );
} else {
  createRoot(document.getElementById("root")).render(
    React.createElement(FeedbackButton, {
      platformId: "00000000-0000-4000-8000-000000000001",
      url: params.get("board"),
      text: "Open feedback",
      widget: "drawer",
    }),
  );
}
