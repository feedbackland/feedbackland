import { atom } from "jotai";

export const isFeedbackFormOpenAtom = atom(true);

export const previousPathnameAtom = atom<string | undefined>(undefined);
