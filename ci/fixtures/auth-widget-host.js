import React from "react";
import { createRoot } from "react-dom/client";
import { FeedbackButton } from "feedbackland-react";

createRoot(document.getElementById("root")).render(
  React.createElement(FeedbackButton, {
    platformId: "",
    url: new URLSearchParams(location.search).get("board"),
    text: "Open feedback",
    widget: "drawer",
  }),
);
