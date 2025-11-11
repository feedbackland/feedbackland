import { atomWithReset } from "jotai/utils";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { RemoteProxy } from "penpal";
import { IframeParentAPI } from "@/lib/typings";

export const previousPathnameAtom = atomWithReset<string | undefined>(
  undefined,
);

export const activtyFeedStateAtom = atomWithReset<{
  searchValue: string;
  page: number;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  ideasSelected: boolean;
  issuesSelected: boolean;
  generalFeedbackSelected: boolean;
  commentsSelected: boolean;
}>({
  searchValue: "",
  page: 1,
  orderBy: "newest",
  status: null,
  ideasSelected: false,
  issuesSelected: false,
  generalFeedbackSelected: false,
  commentsSelected: false,
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
