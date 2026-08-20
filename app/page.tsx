/* eslint-disable @next/next/no-img-element */

import { DesktopSmoothScroll } from "./desktop-smooth-scroll";
import { OfferMenuTrack, OfferTransition } from "./offer-climax";

import { ViewportVideoPlayback } from './viewport-video-playback';

const orderUrl = "https://generationskitchenvegas.com/menu";
const instagramUrl = "https://www.instagram.com/generationskitchenlv/";
const directionsUrl =
  "https://www.google.com/maps/search/?api=1&query=6280+S+Valley+View+Blvd+Building+A+Suite+100%2C+Las+Vegas%2C+NV+89118%2C+USA&query_place_id=ChIJ6TpkRVnFyIARaUhmkEEl8jg";

const offerDishes = [
  {
    name: "Furikake Chicken",
    src: "/media/menu/furikake-chicken.webp",
    href: "https://generationskitchenvegas.com/menu?item=furikake-chicken-BLaD",
  },
  {
    name: "Hurricane Chicken",
    src: "/media/menu/hurricane-chicken.webp",
    href: "https://generationskitchenvegas.com/menu?item=hurricane-chicken-V3Ln",
  },
  {
    name: "Garlic Chicken",
    src: "/media/menu/garlic-chicken.webp",
    href: "https://generationskitchenvegas.com/menu?item=garlic-chicken-9tBv",
  },
  {
    name: "Hamburger Steak",
    src: "/media/menu/hamburger-steak.webp",
    href: "https://generationskitchenvegas.com/menu?item=hamburger-steak-7e8E",
  },
  {
    name: "Loco Moco",
    src: "/media/menu/loco-moco.webp",
    href: "https://generationskitchenvegas.com/menu?item=loco-moco-mvzn",
  },
  {
    name: "Teriyaki Beef",
    src: "/media/menu/teriyaki-beef.webp",
    href: "https://generationskitchenvegas.com/menu?item=teriyaki-beef-Nr2Q",
  },
  {
    name: "Chicken Katsu",
    src: "/media/menu/chicken-katsu.webp",
    href: "https://generationskitchenvegas.com/menu?item=chicken-katsu-QqjI",
  },
  {
    name: "Fried Chicken",
    src: "/media/menu/fried-chicken.webp",
    href: "https://generationskitchenvegas.com/menu?item=fried-chicken-u5Ss",
  },
  {
    name: "Teri Beef Fries",
    src: "/media/menu/teri-beef-fries.webp",
    href: "https://generationskitchenvegas.com/menu?item=teri-beef-fries-sS8t",
  },
  {
    name: "Spicy Poke Bowl",
    src: "/media/menu/poke-bowl-spicy.webp",
    href: "https://generationskitchenvegas.com/menu?item=poke-bowl-spicy-v2TB",
  },
  {
    name: "Hawaiian Poke Bowl",
    src: "/media/menu/poke-bowl-hawaiian.webp",
    href: "https://generationskitchenvegas.com/menu?item=poke-bowl-hawaiian-xDrN",
  },
  {
    name: "Spicy Poke Nachos",
    src: "/media/menu/poke-nachos.webp",
    href: "https://generationskitchenvegas.com/menu?item=poke-nachos-spicy-hGMI",
  },
];

type HomeProps = {
  searchParams: Promise<{ motion?: string }>;
};

type FoodPassageProps = {
  id: string;
  mediaName: string;
  alt: string;
  title: React.ReactNode;
  className: string;
  children?: React.ReactNode;
};

function FoodPassage({
  id,
  mediaName,
  alt,
  title,
  className,
  children,
}: FoodPassageProps) {
  const titleId = `${id}-title`;

  return (
    <section
      className={`food-passage ${className}`}
      id={id}
      data-scroll-beat={id}
      aria-labelledby={titleId}
    >
      <div className="passage-media" aria-hidden="true">
        <video
          className="passage-video"
          data-managed-video
          muted
          loop
          playsInline
          preload="none"
          poster={`/media/${mediaName}-desktop.jpg?v=foodwide1`}
        >
          <source
            media="(max-width: 760px)"
            src={`/media/${mediaName}-mobile.mp4?v=foodwide1`}
            type="video/mp4"
          />
          <source
            src={`/media/${mediaName}-desktop.mp4?v=foodwide1`}
            type="video/mp4"
          />
        </video>

        <picture className="passage-poster">
          <source
            media="(max-width: 760px)"
            srcSet={`/media/${mediaName}-mobile.jpg?v=foodwide1`}
          />
          <img src={`/media/${mediaName}-desktop.jpg?v=foodwide1`} alt={alt} />
        </picture>
      </div>

      <div className="passage-content">
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const { motion } = await searchParams;

  return (
    <main className={motion !== "reduced" ? "force-motion" : undefined}>
      <DesktopSmoothScroll />
      <ViewportVideoPlayback />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Generations Kitchen home">
          <img
            src="/media/generations-kitchen-logo.png"
            alt="Generations Kitchen"
          />
        </a>

        <nav aria-label="Primary navigation">
          <a href={orderUrl} target="_blank" rel="noreferrer">
            Menu
          </a>
          <a href={instagramUrl} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a
            className="order-link"
            href={orderUrl}
            target="_blank"
            rel="noreferrer"
          >
            Order Now <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <a
        className="floating-order"
        href={orderUrl}
        target="_blank"
        rel="noreferrer"
      >
        Order Now <span aria-hidden="true">↗</span>
      </a>

      <OfferTransition />

      <div className="smooth-scroll-wrapper" data-scroll-tau="0.41">
        <div className="smooth-scroll-content">
      <section
        className="opening"
        id="top"
        data-scroll-beat="top"
        aria-labelledby="opening-title"
      >
        <div className="opening-media" aria-hidden="true">
          {/*
            Maintained asset:
            public/media/max-holloway-opening-{desktop,mobile}.mp4.
            Mobile ships the same 1920x1080 desktop cut so phones get the
            highest-fidelity first beat. Future consumer: the site's
            cold-load visitor. Activation: auto-load through these
            responsive video sources. Behavioral check: npm test ffprobes
            both encodes and browser review exercises the entrance, handoff,
            loop, and reduced-motion path. Owner has confirmed permission to
            publish this opening footage. Retire when this restaurant-visit
            carrier is replaced.
          */}
          <video
            className="opening-video"
            data-managed-video
            autoPlay={motion !== "reduced"}
            muted
            loop
            playsInline
            preload={motion === "reduced" ? "none" : "auto"}
            poster="/media/max-holloway-opening-poster.jpg?v=brandfree3"
          >
            <source
              media="(max-width: 760px)"
              src="/media/max-holloway-opening-mobile.mp4?v=openingwide1"
              type="video/mp4"
            />
            <source
              src="/media/max-holloway-opening-desktop.mp4?v=brandfree3"
              type="video/mp4"
            />
          </video>

          <div className="reduced-motion-sequence">
            <img src="/media/max-holloway-entrance.jpg?v=brandfree3" alt="" />
            <img src="/media/restaurant-owner.jpg?v=brandfree3" alt="" />
            <img src="/media/hurricane-food.jpg?v=brandfree3" alt="" />
          </div>
        </div>

        <div className="opening-copy">
          <h1 id="opening-title">
            <span>The Ninth Island</span>
            <span>
              eats <strong>here.</strong>
            </span>
          </h1>
        </div>

        <a className="opening-next" href="#hurricane">
          <span>Meet the plate</span>
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <FoodPassage
        id="hurricane"
        mediaName="hurricane-chicken"
        alt="Hurricane Chicken being prepared and plated at Generations Kitchen"
        className="dish-hurricane"
        title={
          <>
            Hurricane
            <br />
            Chicken.
          </>
        }
      />

      <FoodPassage
        id="loco-moco"
        mediaName="loco-moco"
        alt="Loco Moco plate, hamburger patties on the griddle, and eggs cooking"
        className="dish-loco"
        title={
          <>
            Loco
            <br />
            Moco.
          </>
        }
      />

      <FoodPassage
        id="poke-bowl"
        mediaName="poke-bowl"
        alt="A fresh poke bowl being opened and sauced at Generations Kitchen"
        className="dish-poke"
        title={
          <>
            Poke
            <br />
            Bowl.
          </>
        }
      >
        <div className="dish-cta">
          <h3>
            HUNGRY
            <br />
            YET?
          </h3>
          <a href={orderUrl} target="_blank" rel="noreferrer">
            ORDER NOW
          </a>
        </div>
      </FoodPassage>

      <section
        className="offer-passage"
        id="offer"
        data-scroll-beat="offer"
        aria-labelledby="offer-title"
      >
        <div className="offer-field" aria-hidden="true">
          <span className="offer-ray" />
        </div>

        <div className="offer-stage">
          <h2 id="offer-title" className="visually-hidden">
            First-order offer
          </h2>

          <div className="offer-content">
            <a
              className="offer-action"
              href={orderUrl}
              target="_blank"
              rel="noreferrer"
            >
              $10 OFF YOUR FIRST ORDER
            </a>
            <p className="offer-terms">USE CODE FIRST10 · $30 MINIMUM</p>

            <OfferMenuTrack>
              {offerDishes.map((dish) => (
                <a
                  key={dish.href}
                  className="offer-card"
                  href={dish.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={dish.src} alt={dish.name} />
                  <span>{dish.name}</span>
                </a>
              ))}
            </OfferMenuTrack>
          </div>
        </div>
      </section>

      <section
        className="visit-passage"
        id="visit"
        data-scroll-beat="visit"
        aria-labelledby="visit-title"
      >
        <div className="visit-montage" aria-hidden="true">
          <img
            className="visit-frame visit-frame-one"
            src="/media/visit-interior-lanterns.jpg"
            alt=""
          />
          <img
            className="visit-frame visit-frame-two"
            src="/media/visit-counter-team.jpg"
            alt=""
          />
          <img
            className="visit-frame visit-frame-three"
            src="/media/visit-interior-counter.jpg"
            alt=""
          />
        </div>

        <div className="visit-content">
          <h2 id="visit-title">
            Pull up
            <br />
            hungry.
          </h2>

          <div className="visit-actions">
            <p>
              6280 S Valley View Blvd
              <br />
              Building A, Suite 100 · Las Vegas
            </p>

            <a
              className="visit-order"
              href={orderUrl}
              target="_blank"
              rel="noreferrer"
            >
              Order now <span aria-hidden="true">↗</span>
            </a>

            <div className="visit-links">
              <a href={directionsUrl} target="_blank" rel="noreferrer">
                Directions ↗
              </a>
              <a href={instagramUrl} target="_blank" rel="noreferrer">
                Instagram ↗
              </a>
            </div>
          </div>
        </div>
      </section>
        </div>
      </div>
    </main>
  );
}
