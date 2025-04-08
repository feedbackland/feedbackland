import { atom } from "jotai";

export const isFeedbackFormOpenAtom = atom(true);

export const isInIframeAtom = atom<null | boolean>(null);

export const previousPathnameAtom = atom<string | undefined>(undefined);
