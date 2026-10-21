export const STATUS_LABELS = {
  "under-consideration": "Under consideration",
  planned: "Planned",
  "in-progress": "In progress",
  done: "Done",
  declined: "Declined",
} as const;
export function isStatusLabel(
  value: string,
): value is keyof typeof STATUS_LABELS {
  return Object.hasOwn(STATUS_LABELS, value);
}
