"use client";

import { useEffect } from "react";

/*
Maintained asset: desktop-only time-constant, beat-locked smooth scrolling.
Canonical path: app/desktop-smooth-scroll.tsx.
Future consumer: desktop visitors moving through the Generations Kitchen food
passage with a wheel, trackpad, keyboard, scrollbar, or internal anchor.
Activation: auto-load through DesktopSmoothScroll in app/page.tsx at viewports
761px and wider, unless the URL contains `smooth=off`.
Behavioral check: `npm test` pins the 0.41-second exponential coefficient,
single-clock wrapper, and six beat markers; browser review traverses every beat
forward and backward and confirms each rest lands on one whole viewport while
mobile uses native CSS snapping.
Retirement: remove if the owner selects native desktop scrolling or replaces
this passage with another single-clock, beat-settled scrolling implementation.
*/

export const DESKTOP_SCROLL_TAU_SECONDS = 0.41;

const desktopQuery = "(min-width: 761px)";
const beatSelector = "[data-scroll-beat]";
const settleDistance = 0.1;
const finalSnapRatio = 0.01;
const beatReleaseRatio = 0.08;
const wheelGestureIdleMs = 180;
const scrollIdleMs = 180;

export function DesktopSmoothScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main");
    const forceMotion =
      new URLSearchParams(window.location.search).get("motion") === "full";
    const wrapper = document.querySelector<HTMLElement>(
      ".smooth-scroll-wrapper",
    );
    const content = document.querySelector<HTMLElement>(
      ".smooth-scroll-content",
    );

    if (forceMotion) main?.classList.add("force-motion");

    if (!wrapper || !content) {
      return () => main?.classList.remove("force-motion");
    }

    const desktop = window.matchMedia(desktopQuery);
    const explicitlyDisabled =
      new URLSearchParams(window.location.search).get("smooth") === "off";
    const resizeObserver = new ResizeObserver(updateHeight);

    let active = false;
    let currentY = window.scrollY;
    let targetY = window.scrollY;
    let frame = 0;
    let previousTime = 0;
    let beatElements: HTMLElement[] = [];
    let beatOffsets: number[] = [];
    let activeBeatIndex = 0;
    let beatTransitionLocked = false;
    let wheelGestureActive = false;
    let wheelGestureTimer = 0;
    let scrollIdleTimer = 0;

    function maximumScroll() {
      return Math.max(0, content!.scrollHeight - window.innerHeight);
    }

    function clampScroll(value: number) {
      return Math.min(maximumScroll(), Math.max(0, value));
    }

    function refreshBeatOffsets() {
      beatElements = Array.from(
        content!.querySelectorAll<HTMLElement>(beatSelector),
      );
      beatOffsets = beatElements.map((beat) => clampScroll(beat.offsetTop));
    }

    function nearestBeatIndex(value: number) {
      if (!beatOffsets.length) return 0;

      return beatOffsets.reduce((nearest, offset, index) =>
        Math.abs(offset - value) < Math.abs(beatOffsets[nearest] - value)
          ? index
          : nearest,
      0);
    }

    function directionalBeatIndex(value: number, direction: -1 | 1) {
      if (!beatOffsets.length) return 0;

      if (direction > 0) {
        const next = beatOffsets.findIndex((offset) => offset > value + 1);
        return next < 0 ? beatOffsets.length - 1 : next;
      }

      for (let index = beatOffsets.length - 1; index >= 0; index -= 1) {
        if (beatOffsets[index] < value - 1) return index;
      }

      return 0;
    }

    function markActiveBeat(index: number) {
      activeBeatIndex = Math.min(
        Math.max(0, index),
        Math.max(0, beatOffsets.length - 1),
      );

      const beat = beatElements[activeBeatIndex];
      if (beat) {
        html.dataset.activeScrollBeat = beat.dataset.scrollBeat ?? beat.id;
      }
    }

    function renderPosition() {
      content!.style.transform = `translate3d(0, ${-currentY}px, 0)`;
    }

    function stopAnimation() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      content!.style.removeProperty("will-change");
    }

    function releaseBeatTransitionIfReady() {
      const releaseDistance = Math.max(
        settleDistance,
        window.innerHeight * beatReleaseRatio,
      );

      if (
        !wheelGestureActive &&
        Math.abs(targetY - currentY) <= releaseDistance
      ) {
        beatTransitionLocked = false;
      }
    }

    function tick(time: number) {
      if (!active) return;

      const elapsedSeconds = Math.min(
        Math.max(0, (time - previousTime) / 1000),
        0.1,
      );
      previousTime = time;
      const coefficient =
        1 - Math.exp(-elapsedSeconds / DESKTOP_SCROLL_TAU_SECONDS);

      currentY += (targetY - currentY) * coefficient;

      const finalSnapDistance = Math.max(
        settleDistance,
        window.innerHeight * finalSnapRatio,
      );

      if (Math.abs(targetY - currentY) <= finalSnapDistance) {
        currentY = targetY;
        renderPosition();
        beatTransitionLocked = false;
        markActiveBeat(nearestBeatIndex(targetY));
        stopAnimation();
        return;
      }

      renderPosition();
      releaseBeatTransitionIfReady();
      frame = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (frame || Math.abs(targetY - currentY) <= settleDistance) return;
      content!.style.willChange = "transform";
      previousTime = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function scrollToBeat(index: number, force = false) {
      if (!beatOffsets.length || (beatTransitionLocked && !force)) return;

      const nextIndex = Math.min(
        Math.max(0, index),
        beatOffsets.length - 1,
      );
      const nextY = beatOffsets[nextIndex];

      markActiveBeat(nextIndex);
      targetY = nextY;
      beatTransitionLocked = Math.abs(targetY - currentY) > settleDistance;
      window.scrollTo({ top: nextY, behavior: "auto" });
      startAnimation();
      releaseBeatTransitionIfReady();
    }

    function snapToNearestBeat() {
      if (!active || wheelGestureActive || !beatOffsets.length) return;

      const index = nearestBeatIndex(window.scrollY);
      const nextY = beatOffsets[index];

      if (Math.abs(nextY - window.scrollY) <= 0.5) {
        markActiveBeat(index);
        releaseBeatTransitionIfReady();
        return;
      }

      scrollToBeat(index, true);
    }

    function scheduleNearestBeat() {
      window.clearTimeout(scrollIdleTimer);
      scrollIdleTimer = window.setTimeout(snapToNearestBeat, scrollIdleMs);
    }

    function updateTarget() {
      if (!active) return;
      targetY = clampScroll(window.scrollY);
      markActiveBeat(nearestBeatIndex(targetY));
      startAnimation();
      scheduleNearestBeat();
    }

    function updateHeight() {
      if (!active) return;
      body.style.height = `${content!.scrollHeight}px`;
      refreshBeatOffsets();
      targetY = clampScroll(window.scrollY);
      currentY = clampScroll(currentY);
      markActiveBeat(nearestBeatIndex(targetY));
      renderPosition();
      scheduleNearestBeat();
    }

    function handleWheel(event: WheelEvent) {
      if (
        !active ||
        event.ctrlKey ||
        event.deltaY === 0 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        return;
      }

      event.preventDefault();

      const beginsGesture = !wheelGestureActive;
      wheelGestureActive = true;
      window.clearTimeout(wheelGestureTimer);
      wheelGestureTimer = window.setTimeout(() => {
        wheelGestureActive = false;
        releaseBeatTransitionIfReady();
      }, wheelGestureIdleMs);

      if (!beginsGesture || beatTransitionLocked) return;

      const direction = event.deltaY > 0 ? 1 : -1;
      scrollToBeat(directionalBeatIndex(targetY, direction));
    }

    function handleKeydown(event: KeyboardEvent) {
      if (
        !active ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented ||
        event.repeat ||
        !(event.target instanceof Element) ||
        event.target.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      let requestedIndex: number | null = null;
      let force = false;

      if (
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        (event.key === " " && !event.shiftKey)
      ) {
        requestedIndex = directionalBeatIndex(targetY, 1);
      } else if (
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        (event.key === " " && event.shiftKey)
      ) {
        requestedIndex = directionalBeatIndex(targetY, -1);
      } else if (event.key === "Home") {
        requestedIndex = 0;
        force = true;
      } else if (event.key === "End") {
        requestedIndex = beatOffsets.length - 1;
        force = true;
      }

      if (requestedIndex === null) return;

      event.preventDefault();
      if (!force && beatTransitionLocked) return;
      scrollToBeat(requestedIndex, force);
    }

    function scrollToHash(hash: string, updateHistory: boolean) {
      const target = document.getElementById(hash.slice(1));
      if (!target) return false;

      const beatIndex = beatElements.indexOf(target);
      if (beatIndex >= 0) {
        scrollToBeat(beatIndex, true);
      } else {
        window.scrollTo({ top: clampScroll(target.offsetTop), behavior: "auto" });
        updateTarget();
      }
      if (updateHistory && window.location.hash !== hash) {
        window.history.pushState(null, "", hash);
      }
      return true;
    }

    function handleAnchorClick(event: MouseEvent) {
      if (
        !active ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = link?.getAttribute("href");
      if (!hash || hash === "#" || !scrollToHash(hash, true)) return;
      event.preventDefault();
    }

    function handleHistoryChange() {
      if (!active) return;
      if (window.location.hash) {
        scrollToHash(window.location.hash, false);
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
        updateTarget();
      }
    }

    function enable() {
      if (active || explicitlyDisabled || !desktop.matches) return;

      active = true;
      html.classList.add("smooth-scroll-active");
      html.classList.add("scroll-beat-lock-active");
      html.dataset.scrollTau = String(DESKTOP_SCROLL_TAU_SECONDS);
      currentY = clampScroll(window.scrollY);
      targetY = currentY;
      updateHeight();
      renderPosition();
      resizeObserver.observe(content!);
      window.addEventListener("scroll", updateTarget, { passive: true });
      window.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("keydown", handleKeydown);
      window.addEventListener("popstate", handleHistoryChange);
      document.addEventListener("click", handleAnchorClick);

      if (window.location.hash) {
        requestAnimationFrame(() => scrollToHash(window.location.hash, false));
      } else {
        requestAnimationFrame(snapToNearestBeat);
      }
    }

    function disable() {
      if (!active) return;

      active = false;
      stopAnimation();
      window.clearTimeout(wheelGestureTimer);
      window.clearTimeout(scrollIdleTimer);
      resizeObserver.unobserve(content!);
      window.removeEventListener("scroll", updateTarget);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("popstate", handleHistoryChange);
      document.removeEventListener("click", handleAnchorClick);
      html.classList.remove("smooth-scroll-active");
      html.classList.remove("scroll-beat-lock-active");
      delete html.dataset.scrollTau;
      delete html.dataset.activeScrollBeat;
      body.style.removeProperty("height");
      content!.style.removeProperty("transform");
      beatElements = [];
      beatOffsets = [];
      beatTransitionLocked = false;
      wheelGestureActive = false;
    }

    function handleBreakpoint() {
      if (desktop.matches) enable();
      else disable();
    }

    desktop.addEventListener("change", handleBreakpoint);
    handleBreakpoint();

    return () => {
      desktop.removeEventListener("change", handleBreakpoint);
      disable();
      resizeObserver.disconnect();
      main?.classList.remove("force-motion");
    };
  }, []);

  return null;
}
