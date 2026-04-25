import React from "react";
import ReactDOM from "react-dom/client";
import { FeedbackButton } from "./FeedbackButton";

const platformId = "987637fb-7ca1-4bd6-b608-cc416db75788";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div style={{ width: "100vw", height: "100vh", background: "" }}>
      <FeedbackButton platformId={platformId} widget="drawer" />
      <FeedbackButton
        platformId={platformId}
        widget="popover"
        variant="outline"
        size="sm"
      />
    </div>
  </React.StrictMode>
);
