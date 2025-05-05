import { atom } from "jotai";
import { atomWithReset } from "jotai/utils";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export const previousPathnameAtom = atom<string | undefined>(undefined);

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
