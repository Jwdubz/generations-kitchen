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
The motion climax is a 4.4s held-breath: slam to true black in ~350-400ms,
hold true black for another ~1.3-1.4s, then open through a near-white flash
as the final scene's broad brand-color rays erupt in place over ~2.6s. The
background never swaps; offer copy and dishes stay hidden until the rays
finish and the state becomes `settled`. Keep CSS keyframe duration on the
same 4.4s clock.
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
const climaxDurationMs = 4400;

function prefersExplicitReducedMotion() {
  return new URLSearchParams(window.location.search).get("motion") === "reduced";
}

export function OfferTransition() {
  useEffect(() => {
    const html = document.documentElement;
    const offer = document.getElementById("offer");
    if (!offer) return;

    const desktop = window.matchMedia(desktopQuery);
    let inOffer = false;
    let settleTimer = 0;

    function setClimax(state: "idle" | "playing" | "settled") {
      html.dataset.offerClimax = state;
    }

    function enterOffer() {
      if (inOffer) return;
      inOffer = true;

      if (prefersExplicitReducedMotion()) {
        setClimax("settled");
        return;
      }

      setClimax("playing");
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (inOffer) setClimax("settled");
      }, climaxDurationMs);
    }

    function leaveOffer() {
      if (!inOffer) return;
      inOffer = false;
      window.clearTimeout(settleTimer);
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

    if (prefersExplicitReducedMotion()) setClimax("settled");
    else setClimax("idle");
    syncFromDesktopBeat();

    return () => {
      window.clearTimeout(settleTimer);
      attributeObserver.disconnect();
      intersection.disconnect();
      delete html.dataset.offerClimax;
    };
  }, []);

  return (
    <div className="offer-transition" aria-hidden="true" style={{ pointerEvents: "none" }}>
      <div className="offer-shutter offer-shutter-top" />
      <div className="offer-shutter offer-shutter-bottom" />
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
