export function contentMessage(
  error: {
    message: string;
    data?: { code?: string; resetsAt?: string } | null;
  } | null,
  fallback: string,
) {
  const reset = error?.data?.resetsAt ? new Date(error.data.resetsAt) : null;
  const localReset =
    reset && Number.isFinite(reset.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(reset)
      : "the next daily reset";
  switch (error?.message) {
    case "INVALID_CONTENT_INPUT":
      return "This text could not be processed. Please check its length and formatting.";
    case "RATE_LIMITED":
      return "Too many requests. Please try again in a minute.";
    case "inappropriate-content":
      return "This content was declined by moderation. Please revise it and try again.";
    case "DAILY_LIMIT":
      return `Anonymous posting is paused until ${localReset}. Sign in to post or try again then.`;
    case "AI_PAUSED":
      return `Draft improvements are paused until ${localReset}.`;
    case "VISION_BUSY":
    case "AI_BUSY":
      return "Screening is busy. Please try again in five seconds.";
    case "CONTENT_WRITE_BUSY":
      return "The board is busy saving changes. Please try again shortly.";
    case "CONTENT_CHANGED":
      return "This item changed while you were editing. Reload it before saving.";
    case "CONTENT_SETTINGS_CHANGED":
      return "The board settings changed. Please try again.";
    case "AI_UNAVAILABLE":
    case "AI_NOT_CONFIGURED":
      return "Draft improvements are currently unavailable.";
    default:
      return error?.data?.code === "BAD_REQUEST" ? error.message : fallback;
  }
}
