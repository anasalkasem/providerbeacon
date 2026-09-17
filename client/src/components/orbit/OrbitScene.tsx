import { useEffect, useRef, useState } from "react";
import { createOrbitRenderer } from "./renderer";

export default function OrbitScene({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createOrbitRenderer>>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    if (!canvas.current) return;
    try {
      renderer.current = createOrbitRenderer(canvas.current);
    } catch {
      renderer.current = null;
    }
    setAvailable(Boolean(renderer.current));
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    renderer.current?.setRunning(!paused);
  }, [paused]);
  return (
    <>
      <canvas
        ref={canvas}
        className="orbit-canvas"
        aria-hidden="true"
        hidden={!available}
        data-orbit-renderer="perspective-canvas"
      />
      {!available && (
        <svg
          className="orbit-scene-fallback"
          viewBox="0 0 400 400"
          aria-hidden="true"
        >
          <ellipse
            cx="200"
            cy="220"
            rx="155"
            ry="55"
            fill="none"
            stroke="#8052ff"
            transform="rotate(-25 200 220)"
          />
          <ellipse
            cx="200"
            cy="220"
            rx="155"
            ry="55"
            fill="none"
            stroke="#5bbdff"
            transform="rotate(30 200 220)"
          />
          <path
            d="M176 290 188 150 212 150 224 290Z"
            fill="#45345f"
            stroke="#b59adf"
          />
          <path d="M180 140 200 110 220 140Z" fill="#a98bcf" />
          <path d="M184 143h32v18h-32Z" fill="#ddd0ff" />
          <circle cx="60" cy="230" r="5" fill="#ffb829" />
        </svg>
      )}
    </>
  );
}
