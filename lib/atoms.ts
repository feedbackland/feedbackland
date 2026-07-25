import { atomWithReset } from "jotai/utils";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { RemoteProxy } from "penpal";
import { IframeParentAPI } from "@/lib/typings";

export const previousPathnameAtom = atomWithReset<string | undefined>(
  undefined,
);

export const activtyFeedStateAtom = atomWithReset<{
  searchValue: string;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  category: "all" | "idea" | "issue" | "general feedback" | "comments";
  unseenOnly: boolean;
}>({
  searchValue: "",
  orderBy: "newest",
  status: null,
  category: "all",
  unseenOnly: false,
});

export const feedbackPostsStateAtom = atomWithReset<{
  searchValue: string;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
}>({
  searchValue: "",
  orderBy: "newest",
  status: null,
});

export const expandedInsightsAtom = atomWithReset<Record<string, boolean>>({});

export const iframeParentAtom =
  atomWithReset<RemoteProxy<IframeParentAPI> | null>(null);

export const adminInviteSuccessUrlAtom = atomWithReset<string | null>(null);
