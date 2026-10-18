"use client";
// Public browser hints only. Server authorization never depends on these.
export const clientRuntime: { appUrl?: string; mutationsBlocked: boolean } = {
  mutationsBlocked: false,
};
