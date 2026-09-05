export const MOTION_STORAGE_KEY = "generations-motion-paused";
export const MOTION_CHANGE_EVENT = "generations:motion-change";

export function resolveMotionPaused(search, savedPreference) {
  return new URLSearchParams(search).get("motion") === "reduced" ||
    savedPreference === "paused";
}

export function isMotionPaused() {
  return document.documentElement.dataset.motionPaused === "true";
}

export function readMotionPreference() {
  let saved = null;
  try { saved = window.localStorage.getItem(MOTION_STORAGE_KEY); } catch {}
  return resolveMotionPaused(window.location.search, saved);
}

export function setMotionPaused(paused, persist = true) {
  document.documentElement.dataset.motionPaused = String(paused);
  if (persist) {
    try {
      window.localStorage.setItem(MOTION_STORAGE_KEY, paused ? "paused" : "running");
    } catch {
      // The control still works when browser storage is unavailable.
    }
  }
  if (!paused) {
    const url = new URL(window.location.href);
    if (url.searchParams.get("motion") === "reduced") {
      url.searchParams.delete("motion");
      window.history.replaceState(window.history.state, "", url);
    }
    document.querySelector("main")?.classList.add("force-motion");
  }
  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}

// Restore the saved choice before the first autoplaying video is parsed.
export const motionPreferenceBootstrap = `(() => {
  let saved = null;
  try { saved = localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)}); } catch {}
  document.documentElement.dataset.motionPaused = String(
    new URLSearchParams(location.search).get("motion") === "reduced" || saved === "paused"
  );
  document.addEventListener("play", event => {
    if (document.documentElement.dataset.motionPaused === "true" && event.target instanceof HTMLMediaElement) {
      event.target.pause();
    }
  }, true);
})();`;
