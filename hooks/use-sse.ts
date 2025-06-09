import { useEffect, useRef } from "react";

export function useSSE(
  url: string,
  onMessage: (event: MessageEvent) => void,
  onError?: (error: Event) => void,
) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url || typeof onMessage !== "function") return;

    const eventSource = new EventSource(url);

    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      onMessage(event);
    };

    eventSource.onerror = (error) => {
      if (onError) onError(error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [url, onMessage, onError]);

  return () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };
}
