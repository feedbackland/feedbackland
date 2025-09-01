"use client";

import { WindowMessenger, connect } from "penpal";
import { useEffect } from "react";
import { IframeParentAPI } from "@/lib/typings";
import { useSetAtom } from "jotai";
import { iframeParentAtom } from "@/lib/atoms";

export function IframeProvider({ children }: { children: React.ReactNode }) {
  const setIframeParent = useSetAtom(iframeParentAtom);

  useEffect(() => {
    const messenger = new WindowMessenger({
      remoteWindow: window.parent,
      allowedOrigins: ["*"],
    });

    const connection = connect<IframeParentAPI>({
      messenger,
    });

    connection.promise.then((parent) => {
      setIframeParent(parent);
    });

    return () => {
      setIframeParent(null);
      connection.destroy();
    };
  }, [setIframeParent]);

  return children;
}
