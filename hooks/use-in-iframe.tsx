import { useState, useEffect } from "react";

export function useInIframe() {
  const [inIframe, setInIframe] = useState<null | boolean>(null);

  useEffect(() => {
    setInIframe(!!(window.self !== window.top));
  }, []);

  return inIframe;
}
