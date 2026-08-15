"use client";

/*
Maintained asset: first-order offer climax and food carousel.
Canonical path: app/offer-climax.tsx, with live dependencies app/page.tsx,
app/globals.css, and public/media/menu/*.webp.
Future consumer: the Generations Kitchen visitor moving from Poke appetite to
a first-order offer and dish choice.
Activation: auto-load through OfferTransition and OfferMenuTrack in
app/page.tsx.
Behavioral check: production desktop/mobile cold-load traversal, offer replay,
desktop arrow movement, mobile horizontal movement and vertical exit, plus
`node --test tests/rendered-html.test.mjs`.
Retirement: when the owner removes or replaces the first-order promotion or
replaces this interaction with another verified offer-to-menu passage.
The motion climax is a 3.2s held-breath: slam to true black, hold empty,
then a near-white flash and brand-color burst. Offer copy stays hidden
until `settled`. Keep CSS keyframe duration on the same 3.2s clock.
*/

import { useEffect, useRef } from "react";

const desktopQuery = "(min-width: 761px)";
const climaxDurationMs = 3200;

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
      <div className="offer-burst" />
    </div>
  );
}

export function OfferMenuTrack({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: -1 | 1) {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(".offer-card");
    if (!track || !card) return;

    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "16") || 16;
    const reduced =
      new URLSearchParams(window.location.search).get("motion") === "reduced";
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: reduced ? "auto" : "smooth",
    });
  }

  return (
    <div className="offer-carousel">
      <div className="offer-carousel-controls">
        <button
          type="button"
          className="offer-nav offer-nav-prev"
          aria-label="Previous dishes"
          onClick={() => scrollByCard(-1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          className="offer-nav offer-nav-next"
          aria-label="Next dishes"
          onClick={() => scrollByCard(1)}
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
