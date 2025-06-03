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
  featureRequestsSelected: boolean;
  bugReportsSelected: boolean;
  generalFeedbackSelected: boolean;
  commentsSelected: boolean;
}>({
  searchValue: "",
  page: 1,
  orderBy: "newest",
  status: null,
  featureRequestsSelected: false,
  bugReportsSelected: false,
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

export const iframeParentRefAtom =
  atomWithReset<RemoteProxy<IframeParentAPI> | null>(null);
