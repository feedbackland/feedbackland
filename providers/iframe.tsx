"use client";

import { WindowMessenger, connect } from "penpal";
import { useEffect, useState } from "react";
import { IframeParentAPI } from "@/lib/typings";
import { useAtom } from "jotai";
import { iframeParentAtom } from "@/lib/atoms";
import { useTheme } from "next-themes";

export function IframeProvider({ children }: { children: React.ReactNode }) {
  const [isColorModeSet, setIsColorModeSet] = useState(false);
  const [iframeParent, setIframeParent] = useAtom(iframeParentAtom);
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
          setIsColorModeSet(true);
        },
      },
    });

    connection.promise.then((parent) => {
      setIframeParent(parent);
      // parent.setLoaded(true);
    });

    return () => {
      setIframeParent(null);
      connection.destroy();
    };
  }, [setIframeParent, setTheme]);

  useEffect(() => {
    if (!!iframeParent && isColorModeSet) {
      iframeParent.setLoaded(true);
    }
  }, [iframeParent, isColorModeSet]);

  return children;
}
