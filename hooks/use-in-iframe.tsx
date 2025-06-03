import { useState, useEffect } from "react";

export function useInIframe() {
  const [inIframe, setInIframe] = useState<null | boolean>(null);

  useEffect(() => {
    console.log("zolg");
    setInIframe(!!(window.self !== window.top));
  }, []);

  return inIframe;
}
