"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  MOTION_CHANGE_EVENT,
  MOTION_STORAGE_KEY,
  isMotionPaused,
  readMotionPreference,
  setMotionPaused,
} from "./motion-preference.mjs";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === MOTION_STORAGE_KEY || event.key === null) {
      setMotionPaused(readMotionPreference(), false);
    }
  };
  window.addEventListener(MOTION_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function MotionControl() {
  const paused = useSyncExternalStore(subscribe, isMotionPaused, () => false);
  useEffect(() => setMotionPaused(readMotionPreference(), false), []);
  const label = paused ? "Resume motion" : "Pause motion";

  return (
    <button
      type="button"
      className="motion-control"
      aria-label={label}
      title={label}
      onClick={() => setMotionPaused(!paused)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        {paused ? (
          <path d="M6 3 17 10 6 17Z" />
        ) : (
          <><path d="M4 3h4v14H4Z" /><path d="M12 3h4v14h-4Z" /></>
        )}
      </svg>
    </button>
  );
}
