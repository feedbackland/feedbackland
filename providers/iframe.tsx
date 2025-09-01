"use client";

import { WindowMessenger, connect } from "penpal";
import { useEffect } from "react";
import { IframeParentAPI } from "@/lib/typings";
import { useSetAtom } from "jotai";
import { iframeParentAtom } from "@/lib/atoms";
import { useTheme } from "next-themes";

export function IframeProvider({ children }: { children: React.ReactNode }) {
  const setIframeParent = useSetAtom(iframeParentAtom);
  const { setTheme } = useTheme();

  useEffect(() => {
    const messenger = new WindowMessenger({
      remoteWindow: window.parent,
      allowedOrigins: ["*"],
    });

    const connection = connect<IframeParentAPI>({
      messenger,
      methods: {
        setColorMode: (colorMode: "light" | "dark") => {
          setTheme(colorMode);
        },
      },
    });

    connection.promise.then((parent) => {
      setIframeParent(parent);
    });

    return () => {
      setIframeParent(null);
      connection.destroy();
    };
  }, [setIframeParent, setTheme]);

  return children;
}
