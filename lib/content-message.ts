export function contentMessage(
  error: { message: string; data?: { code?: string } | null } | null,
  fallback: string,
) {
  switch (error?.message) {
    case "INVALID_CONTENT_INPUT":
      return "This text could not be processed. Please check its length and formatting.";
    case "RATE_LIMITED":
      return "Too many requests. Please try again in a minute.";
    case "inappropriate-content":
      return "This content was declined by moderation. Please revise it and try again.";
    case "DAILY_LIMIT":
      return "Anonymous posting is paused until midnight UTC. Sign in to post or try again then.";
    case "AI_PAUSED":
      return "Draft improvements are paused until midnight UTC.";
    case "VISION_BUSY":
    case "AI_BUSY":
      return "Screening is busy. Please try again in five seconds.";
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
