"use client";

/*
Maintained asset: first-order offer climax and food carousel.
Canonical path: app/offer-climax.tsx, with live dependencies app/page.tsx,
app/globals.css, app/offer-carousel-nav.mjs, and public/media/menu/*.webp.
Future consumer: the Generations Kitchen visitor moving from Poke appetite to
a first-order offer and dish choice.
Activation: auto-load through OfferTransition and OfferMenuTrack in
app/page.tsx.
Behavioral check: production desktop/mobile cold-load traversal, offer replay,
desktop arrow movement, mobile horizontal movement and vertical exit, plus
`node --test tests/rendered-html.test.mjs`.
Retirement: when the owner removes or replaces the first-order promotion or
replaces this interaction with another verified offer-to-menu passage.
The motion climax is one master clock: hide the finished offer until
shutoff, slam to true black in ~350-400ms, hold an empty black world,
ignite a soft gold-white seed at the shared origin, expand that exposure
beyond every corner, stage the persistent field/rays underneath, then
clear exposure by opacity only. Radius never retracts. One RAF loop
samples app/offer-climax-timeline.mjs and owns every in-flight pixel.
Chrome and beat-navigation stay locked until `settled`.
Desktop Previous/Next advances a selected DOM index independently of the
clamped physical scrollLeft, aims at that adjacent card's centered offset,
and ignores further button input until that card rests. One horizontal
wheel/trackpad gesture over the track requests that same adjacent step and
stays locked until the gesture goes idle. Vertical wheel intent is not
captured. Do not restore nearest-from-scrollLeft targeting or relative
width-plus-gap jumps.
*/

import { useEffect, useRef } from "react";
import {
  offerCarouselGlideDurationMs,
  offerCarouselSmoothstep,
  offerWheelGestureDecision,
  offerWheelGestureIdleMs,
  resyncOfferCarouselFromUserScroll,
  stepOfferCarousel,
} from "./offer-carousel-nav.mjs";
import {
  CLIMAX_DURATION_MS,
  EXPOSURE_OVERSCAN,
  ORIGIN,
  PHASES,
  SETTLED_SAMPLE,
  sampleOfferClimax,
} from "./offer-climax-timeline.mjs";

const desktopQuery = "(min-width: 761px)";
const mobileOfferEnterRatio = 0.08;
const mobileOfferLeaveRatio = 0.04;

type ClimaxSample = ReturnType<typeof sampleOfferClimax>;

const climaxVarNames = [
  "--offer-field-opacity",
  "--offer-field-clip",
  "--offer-field-scale",
  "--offer-ray-opacity",
  "--offer-ray-clip",
  "--offer-ray-scale",
  "--offer-content-opacity",
  "--offer-content-y",
  "--offer-chrome-opacity",
] as const;
const climaxLockKeys = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  " ",
  "Home",
  "End",
]);

function prefersExplicitReducedMotion() {
  return new URLSearchParams(window.location.search).get("motion") === "reduced";
}

function lockOfferClimaxInput(event: Event) {
  if (event instanceof KeyboardEvent && !climaxLockKeys.has(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
}

function attachOfferClimaxInputLock() {
  window.addEventListener("wheel", lockOfferClimaxInput, {
    capture: true,
    passive: false,
  });
  window.addEventListener("touchmove", lockOfferClimaxInput, {
    capture: true,
    passive: false,
  });
  window.addEventListener("keydown", lockOfferClimaxInput, { capture: true });
}

function detachOfferClimaxInputLock() {
  window.removeEventListener("wheel", lockOfferClimaxInput, { capture: true });
  window.removeEventListener("touchmove", lockOfferClimaxInput, {
    capture: true,
  });
  window.removeEventListener("keydown", lockOfferClimaxInput, { capture: true });
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function applyClimaxSample(html: HTMLElement, sample: ClimaxSample) {
  html.style.setProperty("--offer-field-opacity", String(sample.field));
  html.style.setProperty("--offer-field-clip", `${sample.fieldClip}%`);
  html.style.setProperty("--offer-field-scale", String(sample.fieldScale));
  html.style.setProperty("--offer-ray-opacity", String(sample.rays));
  html.style.setProperty("--offer-ray-clip", `${sample.rayClip}%`);
  html.style.setProperty("--offer-ray-scale", String(sample.rayScale));
  html.style.setProperty("--offer-content-opacity", String(sample.content));
  html.style.setProperty("--offer-content-y", `${sample.contentY}rem`);
  html.style.setProperty("--offer-chrome-opacity", String(sample.chrome));
}

function clearClimaxVars(html: HTMLElement) {
  for (const name of climaxVarNames) {
    html.style.removeProperty(name);
  }
}

export function OfferTransition() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const offer = document.getElementById("offer");
    const canvas = canvasRef.current;
    if (!offer || !canvas) return;

    const desktop = window.matchMedia(desktopQuery);
    const context = canvas.getContext("2d", { alpha: true });
    let inOffer = false;
    let locked = false;
    let frame = 0;
    let startedAt = 0;

    function setClimax(state: "idle" | "playing" | "settled") {
      html.dataset.offerClimax = state;
    }

    function detachLock() {
      if (!locked) return;
      detachOfferClimaxInputLock();
      locked = false;
    }

    function stopClimaxClock() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      startedAt = 0;
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.visibility = "hidden";
      clearClimaxVars(html);
    }

    function sizeCanvas() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function compositorOwnsSettledField(sample: ClimaxSample) {
      return (
        sample.compositor <= 0 &&
        sample.field >= SETTLED_SAMPLE.field &&
        sample.rays >= SETTLED_SAMPLE.rays &&
        sample.white <= 0 &&
        sample.black <= 0 &&
        sample.transient <= 0
      );
    }

    function hideCompositor() {
      canvas.style.visibility = "hidden";
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    function paintClimax(sample: ClimaxSample) {
      if (!context) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);

      const originX = width * ORIGIN.x;
      const originY = height * ORIGIN.y;
      const maxRadius = Math.hypot(
        Math.max(originX, width - originX),
        Math.max(originY, height - originY),
      );

      if (sample.progress <= PHASES.blackHoldEnd && sample.shutter > 0) {
        const bar = (height / 2) * sample.shutter;
        context.fillStyle = "#000";
        context.fillRect(0, 0, width, bar);
        context.fillRect(0, height - bar, width, bar);
      }

      if (sample.black > 0) {
        context.fillStyle = `rgba(0, 0, 0, ${sample.black})`;
        context.fillRect(0, 0, width, height);
      }

      if (sample.white > 0 && sample.whiteRadius > 0) {
        const radius = Math.max(
          sample.whiteRadius * maxRadius * EXPOSURE_OVERSCAN,
          0.5,
        );
        const glow = context.createRadialGradient(
          originX,
          originY,
          0,
          originX,
          originY,
          radius,
        );
        const a = sample.white;
        glow.addColorStop(0, `rgba(255, 253, 248, ${a})`);
        glow.addColorStop(0.22, `rgba(255, 250, 236, ${a})`);
        glow.addColorStop(0.4, `rgba(255, 244, 214, ${a * 0.96})`);
        glow.addColorStop(0.58, `rgba(255, 220, 160, ${a * 0.42})`);
        glow.addColorStop(0.78, `rgba(242, 173, 36, ${a * 0.14})`);
        glow.addColorStop(1, "rgba(255, 248, 230, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }
    }

    function finishSettled() {
      if (!inOffer) return;
      applyClimaxSample(html, SETTLED_SAMPLE);
      paintClimax(SETTLED_SAMPLE);
      hideCompositor();
      detachLock();
      setClimax("settled");
      clearClimaxVars(html);
      frame = 0;
      startedAt = 0;
    }

    function tickClimax(now: number) {
      if (!startedAt) return;
      const progress = clamp01((now - startedAt) / CLIMAX_DURATION_MS);
      const sample = sampleOfferClimax(progress);
      applyClimaxSample(html, sample);
      paintClimax(sample);
      if (compositorOwnsSettledField(sample)) hideCompositor();
      else canvas.style.visibility = "visible";

      if (progress >= 1) {
        finishSettled();
        return;
      }
      frame = window.requestAnimationFrame(tickClimax);
    }

    function startClimax() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      sizeCanvas();
      canvas.style.visibility = "visible";
      startedAt = performance.now();
      applyClimaxSample(html, sampleOfferClimax(0));
      frame = window.requestAnimationFrame(tickClimax);
    }

    function enterOffer() {
      if (inOffer) return;
      inOffer = true;

      if (prefersExplicitReducedMotion()) {
        detachLock();
        stopClimaxClock();
        setClimax("settled");
        return;
      }

      setClimax("playing");
      if (!locked) {
        attachOfferClimaxInputLock();
        locked = true;
      }
      startClimax();
    }

    function leaveOffer() {
      if (!inOffer) return;
      inOffer = false;
      detachLock();
      stopClimaxClock();
      setClimax("idle");
    }

    function syncFromDesktopBeat() {
      if (html.dataset.activeScrollBeat === "offer") enterOffer();
      else if (desktop.matches) leaveOffer();
    }

    const attributeObserver = new MutationObserver(syncFromDesktopBeat);
    attributeObserver.observe(html, {
      attributes: true,
      attributeFilter: ["data-active-scroll-beat"],
    });

    const intersection = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (desktop.matches) {
          if (
            (!entry.isIntersecting || entry.intersectionRatio < 0.12) &&
            html.dataset.activeScrollBeat !== "offer"
          ) {
            leaveOffer();
          }
          return;
        }
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= mobileOfferEnterRatio
        ) {
          enterOffer();
        } else if (
          !entry.isIntersecting ||
          entry.intersectionRatio < mobileOfferLeaveRatio
        ) {
          leaveOffer();
        }
      },
      {
        root: desktop.matches ? null : document.querySelector("main"),
        threshold: [0.04, 0.08, 0.2, 0.4],
      },
    );
    intersection.observe(offer);

    const onResize = () => {
      sizeCanvas();
    };
    window.addEventListener("resize", onResize);
    sizeCanvas();

    if (prefersExplicitReducedMotion()) setClimax("settled");
    else setClimax("idle");
    syncFromDesktopBeat();

    return () => {
      window.removeEventListener("resize", onResize);
      detachLock();
      stopClimaxClock();
      attributeObserver.disconnect();
      intersection.disconnect();
      delete html.dataset.offerClimax;
    };
  }, []);

  return (
    <div className="offer-transition" aria-hidden="true" style={{ pointerEvents: "none" }}>
      <canvas className="offer-detonation" ref={canvasRef} />
    </div>
  );
}

function measureOfferCardOffsets(track: HTMLElement) {
  const trackRect = track.getBoundingClientRect();
  const trackCenter = trackRect.left + trackRect.width / 2;
  return [...track.querySelectorAll<HTMLElement>(".offer-card")].map((card) => {
    const cardRect = card.getBoundingClientRect();
    const cardCenter = cardRect.left + cardRect.width / 2;
    return track.scrollLeft + (cardCenter - trackCenter);
  });
}

export function OfferMenuTrack({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef(0);
  const pendingIndexRef = useRef<number | null>(null);
  const programmaticRef = useRef(false);
  const userScrollingRef = useRef(false);
  const wheelGestureRef = useRef(false);
  const settleTimerRef = useRef(0);
  const wheelIdleTimerRef = useRef(0);
  const frameRef = useRef(0);
  const desktopGlideRef = useRef(false);
  const snapStyleRef = useRef<string | null>(null);
  const stepAdjacentCardRef = useRef<(direction: -1 | 1) => void>(() => {});

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function clearMotionTimers() {
      window.clearTimeout(settleTimerRef.current);
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    function restoreTrackSnap() {
      if (snapStyleRef.current === null) return;
      track.style.scrollSnapType = snapStyleRef.current;
      snapStyleRef.current = null;
      desktopGlideRef.current = false;
    }

    function finishProgrammatic() {
      clearMotionTimers();
      programmaticRef.current = false;
      pendingIndexRef.current = null;
      restoreTrackSnap();
    }

    function resyncFromUserScroll() {
      userScrollingRef.current = false;
      if (programmaticRef.current || pendingIndexRef.current !== null) return;
      const synced = resyncOfferCarouselFromUserScroll(
        {
          selectedIndex: selectedIndexRef.current,
          pendingIndex: pendingIndexRef.current,
          offsets: measureOfferCardOffsets(track),
        },
        track.scrollLeft,
      );
      selectedIndexRef.current = synced.selectedIndex;
    }

    function onScrollEnd() {
      if (desktopGlideRef.current) return;
      if (programmaticRef.current) {
        finishProgrammatic();
        return;
      }
      resyncFromUserScroll();
    }

    function onScroll() {
      if (!programmaticRef.current) userScrollingRef.current = true;
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(() => {
        if (desktopGlideRef.current) return;
        if (programmaticRef.current) {
          finishProgrammatic();
          return;
        }
        resyncFromUserScroll();
      }, 120);
    }

    function startDesktopGlide(targetLeft: number) {
      const startLeft = track.scrollLeft;
      const distance = targetLeft - startLeft;
      const startedAt = performance.now();

      snapStyleRef.current = track.style.scrollSnapType;
      track.style.scrollSnapType = "none";
      desktopGlideRef.current = true;

      const tick = (now: number) => {
        if (!desktopGlideRef.current || !programmaticRef.current) return;

        const progress = Math.min(
          1,
          (now - startedAt) / offerCarouselGlideDurationMs,
        );
        const eased = offerCarouselSmoothstep(progress);
        track.scrollLeft = startLeft + distance * eased;

        if (progress < 1) {
          frameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        track.scrollLeft = targetLeft;
        finishProgrammatic();
      };

      frameRef.current = window.requestAnimationFrame(tick);
    }

    function cancelDesktopGlideForUser() {
      if (!desktopGlideRef.current) return;
      finishProgrammatic();
      resyncFromUserScroll();
    }

    function centerPendingCardAfterResize() {
      if (!desktopGlideRef.current) return;
      const targetIndex = pendingIndexRef.current ?? selectedIndexRef.current;
      finishProgrammatic();
      const offsets = measureOfferCardOffsets(track);
      const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
      const targetLeft = Math.max(
        0,
        Math.min(maxScrollLeft, offsets[targetIndex] ?? track.scrollLeft),
      );
      selectedIndexRef.current = targetIndex;
      track.scrollTo({ left: targetLeft, behavior: "auto" });
    }

    function stepAdjacentCard(direction: -1 | 1) {
      if (pendingIndexRef.current !== null || userScrollingRef.current) {
        return;
      }

      const offsets = measureOfferCardOffsets(track);
      if (offsets.length === 0) return;

      const next = stepOfferCarousel(
        {
          selectedIndex: selectedIndexRef.current,
          scrollLeft: track.scrollLeft,
          pendingIndex: pendingIndexRef.current,
          offsets,
          maxScrollLeft: Math.max(0, track.scrollWidth - track.clientWidth),
        },
        direction,
      );

      selectedIndexRef.current = next.selectedIndex;
      if (next.pendingIndex === null) return;

      pendingIndexRef.current = next.pendingIndex;
      programmaticRef.current = true;
      if (
        window.matchMedia(desktopQuery).matches &&
        !prefersExplicitReducedMotion()
      ) {
        startDesktopGlide(next.scrollLeft);
        return;
      }

      track.scrollTo({
        left: next.scrollLeft,
        behavior: prefersExplicitReducedMotion() ? "auto" : "smooth",
      });

      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = window.requestAnimationFrame(() => {
          if (Math.abs(track.scrollLeft - next.scrollLeft) < 1) {
            programmaticRef.current = false;
            pendingIndexRef.current = null;
          }
        });
      });
    }

    function onWheel(event: WheelEvent) {
      const decision = offerWheelGestureDecision(
        { gestureActive: wheelGestureRef.current },
        {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          ctrlKey: event.ctrlKey,
        },
      );
      wheelGestureRef.current = decision.gestureActive;
      if (!decision.capture) return;

      event.preventDefault();
      window.clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelGestureRef.current = false;
      }, offerWheelGestureIdleMs);

      if (decision.step && decision.direction !== 0) {
        stepAdjacentCard(decision.direction);
      }
    }

    stepAdjacentCardRef.current = stepAdjacentCard;
    track.addEventListener("scrollend", onScrollEnd);
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("wheel", onWheel, { passive: false });
    track.addEventListener("pointerdown", cancelDesktopGlideForUser, {
      passive: true,
    });
    window.addEventListener("resize", centerPendingCardAfterResize);
    return () => {
      track.removeEventListener("scrollend", onScrollEnd);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("pointerdown", cancelDesktopGlideForUser);
      window.removeEventListener("resize", centerPendingCardAfterResize);
      userScrollingRef.current = false;
      wheelGestureRef.current = false;
      window.clearTimeout(wheelIdleTimerRef.current);
      stepAdjacentCardRef.current = () => {};
      finishProgrammatic();
    };
  }, []);

  return (
    <div className="offer-carousel">
      <div className="offer-carousel-controls">
        <button
          type="button"
          className="offer-nav offer-nav-prev"
          aria-label="Previous dishes"
          onClick={() => stepAdjacentCardRef.current(-1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          className="offer-nav offer-nav-next"
          aria-label="Next dishes"
          onClick={() => stepAdjacentCardRef.current(1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="offer-track" ref={trackRef}>
        {children}
      </div>
    </div>
  );
}
