import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "@/firebaseConfig";
import { lazyDelegate } from "../lazy-delegate";

let instance: ReturnType<typeof initializeApp> | undefined;
const getApp = () => (instance ??= initializeApp(firebaseConfig));
export const app = lazyDelegate(getApp);
export const auth = lazyDelegate(() => getAuth(getApp()));
