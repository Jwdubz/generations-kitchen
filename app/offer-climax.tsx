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
The motion climax is a 4.8s held-breath: slam to true black in ~350-400ms,
hold an empty black world, ignite a white point into a full-frame blowout,
then grow Generations color at several speeds into the persistent field.
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
  return {
    plumes: [
      { angle: -0.32, speed: 1.18, width: 0.2, color: GOLD, delay: 0 },
      { angle: 0.58, speed: 0.9, width: 0.17, color: RED, delay: 0.05 },
      { angle: 2.12, speed: 0.74, width: 0.19, color: GREEN, delay: 0.09 },
      { angle: 3.38, speed: 1.04, width: 0.15, color: GOLD, delay: 0.03 },
      { angle: 4.55, speed: 0.68, width: 0.22, color: RED, delay: 0.11 },
      { angle: 5.48, speed: 0.84, width: 0.16, color: GREEN, delay: 0.07 },
    ],
    embers: Array.from({ length: compact ? 8 : 14 }, (_, index) => ({
      angle: (index * 2.399 + 0.31) % (Math.PI * 2),
      dist: 0.1 + (index % 5) * 0.06,
      size: 1.1 + (index % 3) * 0.55,
      speed: 0.16 + (index % 4) * 0.045,
      color: index % 3 === 0 ? GOLD : index % 3 === 1 ? RED : GREEN,
    })),
    glints: [
      { angle: 0.38, delay: 0.07, life: 0.16 },
      { angle: 2.18, delay: 0.13, life: 0.13 },
      { angle: 4.08, delay: 0.19, life: 0.15 },
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
      const burst = (progress - 0.36) / 0.64;
      context.clearRect(0, 0, width, height);
      if (burst < 0) {
        frame = window.requestAnimationFrame(drawDetonation);
        return;
      }

      const originX = width * 0.5;
      const originY = height * 0.38;
      const reach = Math.hypot(width, height);

      const core = clamp01((burst - 0.02) / 0.18);
      const coreFade = 1 - clamp01((burst - 0.22) / 0.55);
      const coreRadius = (1 - (1 - core) * (1 - core)) * reach * 0.42;
      if (coreRadius > 1 && coreFade > 0) {
        const bloom = context.createRadialGradient(
          originX,
          originY,
          0,
          originX,
          originY,
          coreRadius,
        );
        bloom.addColorStop(0, `rgba(255, 255, 255, ${0.95 * coreFade})`);
        bloom.addColorStop(0.18, rgba(GOLD, 0.55 * coreFade));
        bloom.addColorStop(0.55, rgba(RED, 0.16 * coreFade));
        bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = bloom;
        context.fillRect(0, 0, width, height);
      }

      for (const plume of geometry.plumes) {
        const local = clamp01((burst - plume.delay) / 0.5) * plume.speed;
        if (local <= 0) continue;
        const travel = (1 - (1 - Math.min(1, local)) ** 2) * reach * 0.48;
        const cx = originX + Math.cos(plume.angle) * travel * 0.55;
        const cy = originY + Math.sin(plume.angle) * travel * 0.55;
        const radius = Math.max(18, travel * plume.width * 1.8);
        const fade = 1 - clamp01((burst - 0.28 - plume.delay) / 0.62);
        if (fade <= 0) continue;
        const wash = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
        wash.addColorStop(0, rgba(plume.color, 0.42 * fade));
        wash.addColorStop(0.45, rgba(plume.color, 0.16 * fade));
        wash.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = wash;
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.fill();
      }

      context.save();
      context.translate(originX, originY);
      for (const wave of [0, 0.08]) {
        const local = clamp01((burst - wave) / 0.34);
        if (local <= 0 || local >= 1) continue;
        context.beginPath();
        context.strokeStyle = rgba(GOLD, (1 - local) * 0.28);
        context.lineWidth = Math.max(1.2, (1 - local) * 7);
        context.arc(0, 0, local * reach * 0.62, 0, Math.PI * 2);
        context.stroke();
      }

      for (const glint of geometry.glints) {
        const local = (burst - glint.delay) / glint.life;
        if (local <= 0 || local >= 1) continue;
        const spark = Math.sin(local * Math.PI);
        const arm = 7 + spark * 18;
        context.save();
        context.rotate(glint.angle);
        context.strokeStyle = `rgba(255, 255, 255, ${0.85 * spark})`;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(-arm, 0);
        context.lineTo(arm, 0);
        context.moveTo(0, -arm * 0.45);
        context.lineTo(0, arm * 0.45);
        context.stroke();
        context.restore();
      }
      context.restore();

      for (const ember of geometry.embers) {
        const local = clamp01((burst - 0.08) / 0.9);
        if (local <= 0) continue;
        const drift = ember.dist + local * ember.speed;
        const x = originX + Math.cos(ember.angle) * drift * reach;
        const y = originY + Math.sin(ember.angle) * drift * reach;
        const fade = 1 - clamp01((burst - 0.45) / 0.55);
        context.fillStyle = rgba(ember.color, 0.55 * fade);
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
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.28) {
          enterOffer();
        } else if (!entry.isIntersecting || entry.intersectionRatio < 0.12) {
          if (!desktop.matches || html.dataset.activeScrollBeat !== "offer") {
            leaveOffer();
          }
        }
      },
      {
        root: desktop.matches ? null : document.querySelector("main"),
        threshold: [0.12, 0.28, 0.55],
      },
    );
    intersection.observe(offer);

    const onResize = () => {
      if (startedAt) sizeCanvas();
    };
    window.addEventListener("resize", onResize);

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
      <div className="offer-volume offer-volume-gold" />
      <div className="offer-volume offer-volume-red" />
      <div className="offer-volume offer-volume-green" />
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
