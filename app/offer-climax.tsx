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
The motion climax is a 4.8s held-breath: hide the finished offer until
shutoff, slam to true black in ~350-400ms, hold an empty black world,
ignite a white point into a full-frame blowout, then grow graphic
Generations color from the shared origin into the same persistent field.
Chrome and beat-navigation stay locked until `settled`. Keep CSS, canvas,
and the settle timer on the same 4.8s clock.
Desktop Previous/Next advances a selected DOM index independently of the
clamped physical scrollLeft, aims at that adjacent card's measured offset,
and ignores further button input until that card rests. One horizontal
wheel/trackpad gesture over the track requests that same adjacent step and
stays locked until the gesture goes idle. Vertical wheel intent is not
captured. Do not restore nearest-from-scrollLeft targeting or relative
width-plus-gap jumps.
*/

import { useEffect, useRef } from "react";
import {
  offerWheelGestureDecision,
  offerWheelGestureIdleMs,
  resyncOfferCarouselFromUserScroll,
  stepOfferCarousel,
} from "./offer-carousel-nav.mjs";

const desktopQuery = "(min-width: 761px)";
const climaxDurationMs = 4800;
const mobileOfferEnterRatio = 0.08;
const mobileOfferLeaveRatio = 0.04;
const whitePeakEnd = 0.43;
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

type DetonationColor = readonly [number, number, number];
const GOLD: DetonationColor = [242, 173, 36];
const RED: DetonationColor = [179, 24, 31];
const GREEN: DetonationColor = [11, 107, 58];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function rgba(color: DetonationColor, alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${clamp01(alpha)})`;
}

function buildDetonationGeometry(compact: boolean) {
  const colors = [GOLD, RED, GREEN] as const;
  return {
    wedges: [
      { angle: -0.32, speed: 1.16, width: 0.072, color: GOLD, delay: 0 },
      { angle: 0.72, speed: 0.92, width: 0.06, color: RED, delay: 0.04 },
      { angle: 2.18, speed: 0.78, width: 0.068, color: GREEN, delay: 0.07 },
      { angle: 3.46, speed: 1.08, width: 0.055, color: GOLD, delay: 0.02 },
      { angle: 4.62, speed: 0.7, width: 0.064, color: RED, delay: 0.09 },
      { angle: 5.52, speed: 0.86, width: 0.058, color: GREEN, delay: 0.05 },
    ],
    trails: Array.from({ length: compact ? 9 : 20 }, (_, index) => ({
      angle: (index * 2.399 + 0.19) % (Math.PI * 2),
      color: colors[index % 3],
      delay: (index % 7) * 0.016,
      life: 0.2 + (index % 5) * 0.055,
      length: 0.2 + (index % 4) * 0.07,
      width: compact ? 1.7 + (index % 3) * 0.35 : 2.4 + (index % 3) * 0.65,
      speed: 0.58 + (index % 4) * 0.11,
    })),
    embers: Array.from({ length: compact ? 8 : 16 }, (_, index) => ({
      angle: (index * 2.399 + 0.91) % (Math.PI * 2),
      dist: 0.12 + (index % 5) * 0.05,
      size: compact ? 1.6 + (index % 3) * 0.45 : 2.8 + (index % 3) * 0.7,
      speed: 0.18 + (index % 4) * 0.05,
      color: colors[index % 3],
    })),
    glints: [
      { angle: 0.38, delay: 0.04, life: 0.15 },
      { angle: 1.46, delay: 0.1, life: 0.12 },
      { angle: 2.18, delay: 0.08, life: 0.14 },
      { angle: 3.72, delay: 0.16, life: 0.11 },
      { angle: 4.08, delay: 0.12, life: 0.13 },
      { angle: 5.34, delay: 0.19, life: 0.12 },
    ],
  };
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
    let settleTimer = 0;
    let frame = 0;
    let startedAt = 0;
    let geometry = buildDetonationGeometry(false);

    function setClimax(state: "idle" | "playing" | "settled") {
      html.dataset.offerClimax = state;
    }

    function detachLock() {
      if (!locked) return;
      detachOfferClimaxInputLock();
      locked = false;
    }

    function stopDetonation() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      startedAt = 0;
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    function sizeCanvas() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      geometry = buildDetonationGeometry(width < 700);
    }

    function drawDetonation(now: number) {
      if (!context || !startedAt) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const elapsed = now - startedAt;
      const progress = clamp01(elapsed / climaxDurationMs);
      context.clearRect(0, 0, width, height);
      if (progress < whitePeakEnd) {
        if (elapsed < climaxDurationMs) {
          frame = window.requestAnimationFrame(drawDetonation);
        }
        return;
      }

      const originX = width * 0.5;
      const originY = height * 0.38;
      const reach = Math.hypot(width, height);
      const release = (progress - whitePeakEnd) / (1 - whitePeakEnd);

      const core = clamp01(release / 0.2);
      const coreFade = 1 - clamp01((release - 0.18) / 0.62);
      const coreRadius = (1 - (1 - core) * (1 - core)) * reach * 0.28;
      if (coreRadius > 1 && coreFade > 0) {
        const bloom = context.createRadialGradient(
          originX,
          originY,
          0,
          originX,
          originY,
          coreRadius,
        );
        bloom.addColorStop(0, `rgba(255, 255, 255, ${0.9 * coreFade})`);
        bloom.addColorStop(0.16, rgba(GOLD, 0.42 * coreFade));
        bloom.addColorStop(0.42, rgba(RED, 0.1 * coreFade));
        bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = bloom;
        context.fillRect(0, 0, width, height);
      }

      for (const wedge of geometry.wedges) {
        const local = clamp01((release - wedge.delay) / 0.42) * wedge.speed;
        if (local <= 0) continue;
        const travel = (1 - (1 - Math.min(1, local)) ** 2) * reach * 0.62;
        const fade = 1 - clamp01((release - 0.22 - wedge.delay) / 0.7);
        if (fade <= 0 || travel < 8) continue;
        const halfWidth = Math.max(9, travel * wedge.width);
        context.save();
        context.translate(originX, originY);
        context.rotate(wedge.angle);
        const wash = context.createLinearGradient(0, 0, travel, 0);
        wash.addColorStop(0, rgba(wedge.color, 0.82 * fade));
        wash.addColorStop(0.38, rgba(wedge.color, 0.34 * fade));
        wash.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = wash;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(travel, -halfWidth);
        context.lineTo(travel * 1.04, 0);
        context.lineTo(travel, halfWidth);
        context.closePath();
        context.fill();
        context.restore();
      }

      context.save();
      context.translate(originX, originY);
      for (const wave of [0, 0.07]) {
        const local = clamp01((release - wave) / 0.3);
        if (local <= 0 || local >= 1) continue;
        context.beginPath();
        context.strokeStyle = rgba(GOLD, (1 - local) * 0.42);
        context.lineWidth = Math.max(1.4, (1 - local) * 6);
        context.arc(0, 0, local * reach * 0.7, 0, Math.PI * 2);
        context.stroke();
      }

      context.lineCap = "round";
      for (const trail of geometry.trails) {
        const local = (release - trail.delay) / trail.life;
        if (local <= 0 || local >= 1) continue;
        const head = Math.min(1, local * trail.speed);
        const tail = Math.max(0, head - trail.length);
        const fade = Math.sin(local * Math.PI);
        context.strokeStyle = rgba(trail.color, 0.78 * fade);
        context.lineWidth = trail.width;
        context.beginPath();
        context.moveTo(
          Math.cos(trail.angle) * tail * reach,
          Math.sin(trail.angle) * tail * reach,
        );
        context.lineTo(
          Math.cos(trail.angle) * head * reach,
          Math.sin(trail.angle) * head * reach,
        );
        context.stroke();
      }

      for (const glint of geometry.glints) {
        const local = (release - glint.delay) / glint.life;
        if (local <= 0 || local >= 1) continue;
        const spark = Math.sin(local * Math.PI);
        const arm = 10 + spark * 26;
        context.save();
        context.rotate(glint.angle);
        context.strokeStyle = `rgba(255, 255, 255, ${0.88 * spark})`;
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(-arm, 0);
        context.lineTo(arm, 0);
        context.moveTo(0, -arm * 0.42);
        context.lineTo(0, arm * 0.42);
        context.stroke();
        context.restore();
      }
      context.restore();

      for (const ember of geometry.embers) {
        const local = clamp01((release - 0.04) / 0.86);
        if (local <= 0) continue;
        const drift = ember.dist + local * ember.speed;
        const x = originX + Math.cos(ember.angle) * drift * reach;
        const y = originY + Math.sin(ember.angle) * drift * reach;
        const fade = 1 - clamp01((release - 0.38) / 0.58);
        if (fade <= 0) continue;
        context.fillStyle = rgba(ember.color, 0.7 * fade);
        context.beginPath();
        context.arc(x, y, ember.size, 0, Math.PI * 2);
        context.fill();
      }

      if (elapsed < climaxDurationMs) {
        frame = window.requestAnimationFrame(drawDetonation);
      }
    }

    function startDetonation() {
      stopDetonation();
      sizeCanvas();
      startedAt = performance.now();
      frame = window.requestAnimationFrame(drawDetonation);
    }

    function enterOffer() {
      if (inOffer) return;
      inOffer = true;

      if (prefersExplicitReducedMotion()) {
        detachLock();
        stopDetonation();
        setClimax("settled");
        return;
      }

      setClimax("playing");
      if (!locked) {
        attachOfferClimaxInputLock();
        locked = true;
      }
      startDetonation();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!inOffer) return;
        detachLock();
        stopDetonation();
        setClimax("settled");
      }, climaxDurationMs);
    }

    function leaveOffer() {
      if (!inOffer) return;
      inOffer = false;
      window.clearTimeout(settleTimer);
      detachLock();
      stopDetonation();
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
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", onResize);
      detachLock();
      stopDetonation();
      attributeObserver.disconnect();
      intersection.disconnect();
      delete html.dataset.offerClimax;
    };
  }, []);

  return (
    <div className="offer-transition" aria-hidden="true" style={{ pointerEvents: "none" }}>
      <div className="offer-shutter offer-shutter-top" />
      <div className="offer-shutter offer-shutter-bottom" />
      <canvas className="offer-detonation" ref={canvasRef} />
      <div className="offer-flash" />
    </div>
  );
}

function measureOfferCardOffsets(track: HTMLElement) {
  const trackLeft = track.getBoundingClientRect().left;
  return [...track.querySelectorAll<HTMLElement>(".offer-card")].map(
    (card) => track.scrollLeft + card.getBoundingClientRect().left - trackLeft,
  );
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
  const stepAdjacentCardRef = useRef<(direction: -1 | 1) => void>(() => {});

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function clearMotionTimers() {
      window.clearTimeout(settleTimerRef.current);
      window.cancelAnimationFrame(frameRef.current);
    }

    function finishProgrammatic() {
      programmaticRef.current = false;
      pendingIndexRef.current = null;
      clearMotionTimers();
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
        if (programmaticRef.current) {
          finishProgrammatic();
          return;
        }
        resyncFromUserScroll();
      }, 120);
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
    return () => {
      track.removeEventListener("scrollend", onScrollEnd);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
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
