import { useEffect, useRef } from "react";
import canvasConfetti, { CreateTypes } from "canvas-confetti";

export function Confetti({
  onInit,
}: {
  onInit: (params: { confetti: CreateTypes }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confetti = useRef<CreateTypes | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    confetti.current = canvasConfetti.create(canvasRef.current, {
      resize: true,
      useWorker: false,
    });

    onInit?.({ confetti: confetti.current });

    return () => {
      confetti.current?.reset();
    };
  }, [onInit]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        pointerEvents: "none",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
      }}
      // className={className}
      // width={width}
      // height={height}
    />
  );
}
