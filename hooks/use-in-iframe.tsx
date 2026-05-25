import { useState, useEffect } from "react";

export function useInIframe() {
  const [inIframe, setInIframe] = useState<boolean>(false);

  useEffect(() => {
    setInIframe(window.self !== window.top);
  }, []);

  return inIframe;
}
