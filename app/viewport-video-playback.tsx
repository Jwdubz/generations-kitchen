"use client";

import { useEffect } from "react";

/*
Maintained asset: single-active-video lifecycle for the full-screen passage.
Canonical path: app/viewport-video-playback.tsx.
Future consumer: mobile and desktop visitors moving between video beats.
Activation: auto-load through ViewportVideoPlayback in app/page.tsx; every
video marked data-managed-video participates on a force-motion page.
Behavioral check: `node --test tests/rendered-html.test.mjs` requires one
cold-load autoplay and the Pixel Android lab exercises the real Chrome
consumer, including one visible passage video playing and every video paused
on the non-video offer beat.
Retirement: when this passage adopts an equivalent consumer-verified
single-decoder player or no longer contains multiple video beats.
*/
export function ViewportVideoPlayback() {
  useEffect(() => {
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>('video[data-managed-video]'),
    );
    if (videos.length === 0) return;

    const main = document.querySelector('main');
    if (!main?.classList.contains('force-motion')) {
      videos.forEach((video) => video.pause());
      return;
    }

    const visibility = new Map<HTMLVideoElement, number>(
      videos.map((video) => [video, 0]),
    );
    let activeVideo: HTMLVideoElement | null = null;

    const activate = (nextVideo: HTMLVideoElement | null) => {
      const visibleVideo =
        document.visibilityState === 'visible' ? nextVideo : null;

      videos.forEach((video) => {
        const isActive = video === visibleVideo;
        video.dataset.playbackActive = isActive ? 'true' : 'false';
        if (!isActive) {
          video.pause();
          return;
        }
        if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
        void video.play().catch(() => {
          // The authored poster remains if muted inline autoplay is declined.
        });
      });
      activeVideo = visibleVideo;
    };

    const syncActiveVideo = () => {
      const nextVideo =
        [...visibility.entries()]
          .filter(([, ratio]) => ratio >= 0.18)
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      if (nextVideo !== activeVideo || nextVideo?.paused) activate(nextVideo);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(
            entry.target as HTMLVideoElement,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        });
        syncActiveVideo();
      },
      { threshold: [0, 0.18, 0.4, 0.7, 0.9] },
    );

    videos.forEach((video) => observer.observe(video));
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') activate(null);
      else syncActiveVideo();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      videos.forEach((video) => video.pause());
    };
  }, []);
  return null;
}
