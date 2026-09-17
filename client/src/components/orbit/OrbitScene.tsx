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
          <defs>
            <linearGradient id="beacon-silver" x1="0" x2="1">
              <stop offset="0" stopColor="#4d697b" />
              <stop offset=".4" stopColor="#d5eff9" />
              <stop offset="1" stopColor="#415b6b" />
            </linearGradient>
          </defs>
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
            d="M176 290Q185 228 188 163H212Q215 228 224 290Q200 301 176 290Z"
            fill="url(#beacon-silver)"
          />
          <ellipse
            cx="200"
            cy="291"
            rx="35"
            ry="11"
            fill="url(#beacon-silver)"
          />
          <path d="M180 123Q200 99 220 123Z" fill="url(#beacon-silver)" />
          <path
            d="M186 126h28v29h-28Z"
            fill="#71c5eb"
            fillOpacity=".5"
            stroke="#b6eaff"
          />
          <ellipse
            cx="200"
            cy="160"
            rx="26"
            ry="6"
            fill="url(#beacon-silver)"
          />
          <circle cx="200" cy="140" r="5" fill="#e3f8ff" />
          <circle cx="60" cy="230" r="5" fill="#ffb829" />
        </svg>
      )}
    </>
  );
}
