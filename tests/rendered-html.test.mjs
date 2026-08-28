import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  adjacentOfferCardTarget,
  nearestOfferCardIndex,
  offerWheelGestureDecision,
  offerWheelGestureIdleMs,
  resyncOfferCarouselFromUserScroll,
  stepOfferCarousel,
} from "../app/offer-carousel-nav.mjs";
import {
  CLIMAX_DURATION_MS,
  CONTENT_Y_START,
  EXPOSURE_OVERSCAN,
  PHASE_BOUNDARIES,
  PHASE_MS,
  PHASES,
  SAMPLE_KEYS,
  SAMPLE_RANGES,
  SETTLED_FIELD_CLIP,
  SETTLED_RAY_CLIP,
  SETTLED_RAY_OPACITY,
  SETTLED_SAMPLE,
  START_SAMPLE,
  TERMINAL_EXPOSURE_RADIUS,
  exposureCoversFrame,
  sampleOfferClimax,
} from "../app/offer-climax-timeline.mjs";

const projectRoot = new URL("../", import.meta.url);
const execFileAsync = promisify(execFile);

async function render() {
  const html = await readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Focused experience-boundary tripwire at tests/rendered-html.test.mjs for the
// next Generations Kitchen page editor. Activation: execute `npm test`. The
// exported HTML consumer requires the approved opening, three food beats,
// the offer beat, current menu/directions/Instagram destinations, and the
// removed broadcast name and retired order host to stay absent. Retire only
// if the owner approves a different journey or destination contract.
test("exports the complete Generations Kitchen passage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Generations Kitchen \| Hawai‘i Kine Grindz in Las Vegas/);
  assert.match(html, /The Ninth Island/);
  assert.doesNotMatch(html, /here\./);
  assert.doesNotMatch(html, /Chicken\./);
  assert.doesNotMatch(html, /Moco\./);
  assert.doesNotMatch(html, /Bowl\./);
  assert.match(html, /<span>Pull up<\/span>/);
  assert.match(html, /<strong>hungry\.<\/strong>/);
  assert.match(html, /max-holloway-opening-desktop\.mp4/);
  assert.match(html, /max-holloway-opening-mobile\.mp4/);
  assert.match(html, /class="opening-copy"><h1 id="opening-title"/);
  assert.doesNotMatch(html, /Hawai‘i kine grindz, cooked in Las Vegas\./);
  assert.match(html, /https:\/\/generationskitchenvegas\.com\/menu/);
  assert.doesNotMatch(html, /https:\/\/orders\.generationskitchenvegas\.com\//);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);

  const foodPassages = html.match(/class="food-passage /g) ?? [];
  assert.equal(foodPassages.length, 3, "the journey should contain three food beats");

  for (const id of ["hurricane", "loco-moco", "poke-bowl", "offer", "visit"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  for (const mediaName of ["hurricane-chicken", "loco-moco", "poke-bowl"]) {
    assert.match(html, new RegExp(`${mediaName}-desktop\\.mp4`));
    assert.match(html, new RegExp(`${mediaName}-mobile\\.mp4`));
  }

  assert.doesNotMatch(html, /teri-beef-fries-(?:desktop|mobile)\.mp4/);
  assert.doesNotMatch(html, /id="teri-beef-fries"/);
  assert.doesNotMatch(html, /hurricane-fries-(?:desktop|mobile)\.mp4/);

  assert.match(html, /6280 S Valley View Blvd/);
  assert.match(
    html,
    /class="visit-address"[^>]*href="https:\/\/www\.google\.com\/maps\/search\/\?api=1/,
  );
  assert.match(html, /Directions/);
  assert.match(html, /generationskitchenlv/);
  assert.match(html, /https:\/\/generations\.jarrettwroten\.com\/og\.png/);
  assert.doesNotMatch(html, /live entertainment/i);

  const excludedBroadcastName = "U" + "FC";
  assert.ok(
    !html.includes(excludedBroadcastName),
    "rendered copy should omit the broadcast brand",
  );

  const maxFrame = html.indexOf(
    'src="/media/max-holloway-entrance.jpg?v=brandfree3"',
  );
  const ownerFrame = html.indexOf(
    'src="/media/restaurant-owner.jpg?v=brandfree3"',
  );
  assert.ok(maxFrame >= 0, "the reduced-motion Max frame should be rendered");
  assert.ok(
    maxFrame < ownerFrame,
    "Max Holloway should be the first reduced-motion frame",
  );
});

// Focused cache-bust tripwire at tests/rendered-html.test.mjs for the next
// media-URL editor. Activation: execute `npm test`. Its page-source consumer
// requires foodwide1 on every rebuilt menu video/poster and openingwide1 on
// the full-frame mobile opening, while unchanged opening desktop, poster, and
// fallback stills stay on brandfree3. Retire when a later media rebuild
// needs a new cache key.
test("busts cached enlarged menu and mobile-opening media", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    pageSource,
    /\$\{mediaName\}-desktop\.jpg\?v=foodwide1/,
  );
  assert.match(
    pageSource,
    /\$\{mediaName\}-mobile\.mp4\?v=foodwide1/,
  );
  assert.match(
    pageSource,
    /\$\{mediaName\}-desktop\.mp4\?v=foodwide1/,
  );
  assert.match(
    pageSource,
    /\$\{mediaName\}-mobile\.jpg\?v=foodwide1/,
  );
  assert.doesNotMatch(
    pageSource,
    /\$\{mediaName\}-mobile\.mp4\?v=noticker1/,
    "rebuilt menu assets must not keep the punched-in mobile cache key",
  );
  assert.match(
    pageSource,
    /max-holloway-opening-mobile\.mp4\?v=openingwide1/,
  );
  const openingCss = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    openingCss,
    /@media \(max-width: 760px\) \{[\s\S]*?\.opening-video \{[\s\S]*?height:\s*calc\(100vw \* 968 \/ 1920\)[\s\S]*?object-fit:\s*cover/,
  );
  assert.match(
    pageSource,
    /max-holloway-opening-desktop\.mp4\?v=brandfree3/,
  );
  assert.match(
    pageSource,
    /max-holloway-opening-poster\.jpg\?v=brandfree3/,
  );
  assert.match(
    pageSource,
    /max-holloway-entrance\.jpg\?v=brandfree3/,
  );
  assert.doesNotMatch(
    pageSource,
    /peopleclean1/,
    "rebuilt menu assets must not keep the pre-native-crop cache key",
  );
  assert.doesNotMatch(
    pageSource,
    /max-holloway-opening-mobile\.mp4\?v=brandfree3/,
    "the rebuilt mobile opening must not keep the pre-wide-frame cache key",
  );
});

// Focused unfiltered-media tripwire at tests/rendered-html.test.mjs for the next
// Generations Kitchen media editor. Activation: execute `npm test`. Its exported
// HTML and production-CSS consumers require authored source frames with no
// full-frame shade elements, header background, or CSS video filter. Retire only
// if the owner explicitly approves a new treatment over the footage and its
// representative rendered states.
test("leaves the opening and food media visually unfiltered", async () => {
  const html = await (await render()).text();
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(
    html,
    /class="(?:opening-shade|passage-shade|visit-shade)"/,
    "the passage should not render dark overlay elements over its media",
  );
  assert.doesNotMatch(
    css,
    /\.(?:opening-shade|passage-shade|visit-shade)\b/,
    "the removed overlay family should not survive in production CSS",
  );

  const videoBlocks = [...css.matchAll(/([^{}]*(?:opening-video|passage-video)[^{}]*)\{([^{}]*)\}/g)]
    .map((match) => match[2])
    .join("\n");
  assert.doesNotMatch(videoBlocks, /\b(?:filter|backdrop-filter)\s*:/);
  assert.match(
    css,
    /@media \(max-width:\s*760px\) \{[\s\S]*?\.food-passage \.passage-video,[\s\S]*?object-fit:\s*contain;/,
    "mobile food beats must show the same zoomed-out frame instead of a 9:16 punch-in",
  );
  assert.match(
    css,
    /@media \(min-width: 761px\) \{[\s\S]*?\.opening-video,[\s\S]*?\.food-passage \.passage-video,[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*cover/,
    "desktop opening and food videos must stay full-bleed",
  );
  assert.match(
    css,
    /\.visit-content \{[\s\S]*?flex-direction:\s*column/,
    "the last-beat lockup must stay a stacked flex column",
  );
  assert.doesNotMatch(
    css,
    /\.visit-content\s*\{[^}]*display:\s*grid/,
    "no Visit grid display may remain",
  );
  assert.doesNotMatch(
    css,
    /grid-template-columns:/,
    "no Visit grid-template-columns may remain",
  );

  const headerStart = css.indexOf(".site-header {");
  assert.ok(headerStart >= 0, "the fixed header should have a style block");
  const headerOpen = css.indexOf("{", headerStart);
  const headerClose = css.indexOf("}", headerOpen);
  const headerBlock = css.slice(headerOpen + 1, headerClose);
  assert.doesNotMatch(
    headerBlock,
    /\bbackground(?:-image)?\s*:/,
    "the fixed header should not darken the footage behind it",
  );
});

// Focused GitHub Pages export tripwire at tests/rendered-html.test.mjs for the
// next deployment editor. Activation: execute `npm test`. The static-hosting
// consumer requires output: "export", a complete dist/client/index.html, a
// video-led default desktop and mobile path with an explicit reduced-motion
// opt-out, and a Pages workflow that publishes that exact directory. Retire if
// the owner moves the canonical site away from static GitHub Pages hosting.
test("emits the complete passage as a GitHub Pages artifact", async () => {
  const exportedHtml = await readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );
  const nextConfig = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
  const customDomain = await readFile(
    new URL("../public/CNAME", import.meta.url),
    "utf8",
  );
  const scrollSource = await readFile(
    new URL("../app/desktop-smooth-scroll.tsx", import.meta.url),
    "utf8",
  );

  assert.match(nextConfig, /output:\s*["']export["']/);
  assert.match(exportedHtml, /The Ninth Island/);
  assert.match(exportedHtml, /max-holloway-opening-desktop\.mp4/);
  assert.match(exportedHtml, /https:\/\/generations\.jarrettwroten\.com/);
  assert.match(exportedHtml, /<main class="force-motion"/);
  assert.match(scrollSource, /motionPreference\s*!==\s*"reduced"/);
  assert.match(scrollSource, /classList\.add\("force-motion"\)/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path:\s*dist\/client/);
  assert.equal(customDomain.trim(), "generations.jarrettwroten.com");
  await access(new URL("../public/.nojekyll", import.meta.url));
});

// Focused tripwire: motion default and single-active-video lifecycle.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: the next motion-preference or passage-video editor.
// Activation: execute `node --test tests/rendered-html.test.mjs` after build.
// Behavioral check: the page, client, CSS, and exported-HTML consumers require
// video-led motion as the public desktop/mobile default, exactly one cold-load
// autoplay, every video on the managed lifecycle, deferred passage loading,
// and pause/play/visibility handling. The static presentation remains available
// only through `?motion=reduced`; `?motion=full` remains accepted.
// Retirement: when the owner changes the default-vs-explicit-reduced contract
// and the passage no longer needs a single-active-video lifecycle.
test("defaults to video-led motion unless the visitor asks for reduced motion", async () => {
  const playbackSource = await readFile(
    new URL('../app/viewport-video-playback.tsx', import.meta.url),
    'utf8',
  );
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const scrollSource = await readFile(
    new URL("../app/desktop-smooth-scroll.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const exportedHtml = await readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );

  assert.match(
    pageSource,
    /<main className=\{motion !== "reduced" \? "force-motion" : undefined\}>/,
  );
  assert.doesNotMatch(
    pageSource,
    /motion === "full" \? "force-motion"/,
    "the server default must not wait for ?motion=full",
  );
  assert.match(
    exportedHtml,
    /<main class="force-motion"/,
    "the static export must ship force-motion so videos are visible before JS",
  );

  assert.match(scrollSource, /motionPreference\s*!==\s*"reduced"/);
  assert.match(
    scrollSource,
    /if \(forceMotion\) main\?\.classList\.add\("force-motion"\);\s*else main\?\.classList\.remove\("force-motion"\);/,
  );
  assert.doesNotMatch(
    scrollSource,
    /mobileMotionDefault/,
    "desktop and mobile must share the same video-led default",
  );
  assert.match(scrollSource, /\?motion=full/);

  assert.equal(
    exportedHtml.match(/\bautoPlay=/g)?.length,
    1,
    'only the cold-load opening may claim a decoder before intersection',
  );
  assert.equal(
    exportedHtml.match(/data-managed-video=/g)?.length,
    4,
    'every motion beat must participate in the single-active-video lifecycle',
  );
  assert.match(pageSource, /preload=\x22none\x22/);
  assert.match(pageSource, /autoPlay=\{motion !== \x22reduced\x22\}/);
  assert.match(playbackSource, /new IntersectionObserver/);
  assert.match(playbackSource, /video\.pause\(\)/);
  assert.match(playbackSource, /void video\.play\(\)\.catch/);
  assert.match(playbackSource, /document\.visibilityState/);

  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\) \{[\s\S]*?\.opening-video,[\s\S]*?\.passage-video \{[\s\S]*?display:\s*none;/,
  );
  assert.match(
    css,
    /\.force-motion \.opening-video,[\s\S]*?\.force-motion \.passage-video \{[\s\S]*?display:\s*block;/,
  );
});

// Focused CTA-surface tripwire at tests/rendered-html.test.mjs for future page
// editors. Activation: execute `npm test`. Its server-rendered HTML and
// production CSS consumers require the fixed Order Now header with a
// decorative green up-right arrow, gold Loco heading, white Poke heading,
// gold Hungry Yet on Poke Bowl with no Poke dish-cta anchor, gold header
// Menu/Instagram at rest with a half-pixel black stroke, the logo's
// ambient shadow plus a 0.65px black alpha-edge, the shared display face,
// the pill-shaped header action, one fixed bottom-center order action
// outside the moving passage, and the centered Visit lockup that stacks
// title, address, Order Now, Directions, and Instagram as one middle
// column without a panel. Directional arrows stay the approved
// deep green.
// Retire if the owner approves a different CTA composition, heading color
// split, visit lockup, or order language.
test("keeps the visitor calls to action on the display face", async () => {
  const html = await (await render()).text();
  assert.match(html, /<h3>\s*HUNGRY\s*<br\s*\/?>\s*YET\?\s*<\/h3>/);
  assert.match(
    html,
    /<a href="https:\/\/generationskitchenvegas\.com\/menu" target="_blank" rel="noreferrer">\s*Menu\s*<\/a>/,
  );
  assert.match(
    html,
    /<a href="https:\/\/www\.instagram\.com\/generationskitchenlv\/" target="_blank" rel="noreferrer">\s*Instagram\s*<\/a>/,
  );
  assert.match(
    html,
    /class="order-link"[^>]*>\s*Order Now\s*<span aria-hidden="true">↗<\/span>/,
  );
  assert.match(
    html,
    /class="floating-order"[^>]*>\s*Order Now\s*<span aria-hidden="true">↗<\/span>/,
  );
  assert.match(
    html,
    /class="visit-order"[^>]*>\s*Order now\s*<span aria-hidden="true">↗<\/span>/,
  );
  assert.match(
    html,
    /class="offer-action"[^>]*>\s*\$10 OFF YOUR FIRST ORDER\s*<\/a>/,
  );
  assert.doesNotMatch(html, /Order online/i);
  assert.doesNotMatch(html, /dish-detail|Marinated boneless chicken|Get the plate/);

  const pokeStart = html.indexOf('id="poke-bowl"');
  const offerStart = html.indexOf('id="offer"');
  const dishCta = html.indexOf('class="dish-cta"');
  const hungry = html.search(/<h3>\s*HUNGRY\s*<br\s*\/?>\s*YET\?\s*<\/h3>/);
  assert.ok(
    pokeStart >= 0 &&
      dishCta > pokeStart &&
      dishCta < offerStart &&
      hungry > pokeStart &&
      hungry < offerStart,
    "HUNGRY YET? should remain on Poke Bowl before the offer beat",
  );
  const pokeHtml = html.slice(pokeStart, offerStart);
  assert.doesNotMatch(pokeHtml, /ORDER NOW/);
  assert.doesNotMatch(pokeHtml, /<a\b/);

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const blockFor = (selector) => {
    const selectorIndex = css.indexOf(selector);
    assert.ok(selectorIndex >= 0, `${selector} should have a style block`);
    const openBrace = css.indexOf("{", selectorIndex);
    const closeBrace = css.indexOf("}", openBrace);
    return css.slice(openBrace + 1, closeBrace);
  };
  const mediaBlocks = (query) => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = [];
    const needle = `@media ${query}`;
    let from = 0;
    while (from < source.length) {
      const start = source.indexOf(needle, from);
      if (start === -1) break;
      const openBrace = source.indexOf("{", start);
      let depth = 0;
      let end = openBrace;
      for (; end < source.length; end += 1) {
        if (source[end] === "{") depth += 1;
        else if (source[end] === "}") {
          depth -= 1;
          if (depth === 0) {
            blocks.push(source.slice(openBrace + 1, end));
            end += 1;
            break;
          }
        }
      }
      from = end;
    }
    return blocks;
  };
  const nestedBlocksFor = (chunk, selector) => {
    const blocks = [];
    let from = 0;
    while (from < chunk.length) {
      const selectorIndex = chunk.indexOf(selector, from);
      if (selectorIndex === -1) break;
      const openBrace = chunk.indexOf("{", selectorIndex);
      let depth = 0;
      for (let index = openBrace; index < chunk.length; index += 1) {
        if (chunk[index] === "{") depth += 1;
        else if (chunk[index] === "}") {
          depth -= 1;
          if (depth === 0) {
            blocks.push(chunk.slice(openBrace + 1, index));
            from = index + 1;
            break;
          }
        }
      }
    }
    return blocks;
  };

  const ctaBlock = blockFor(".dish-cta {");
  const hungryBlock = blockFor(".dish-poke .dish-cta h3 {");
  const orderBlock = blockFor(".visit-order {");
  const headerOrderBlock = blockFor(".order-link {");
  const navLinkBlock = blockFor("nav a:not(.order-link) {");
  const brandImgBlock = blockFor(".brand img {");
  const locoHeadingBlock = blockFor(".dish-loco h2 {");
  const pokeHeadingBlock = blockFor(".dish-poke h2 {");
  const pokeContentBlock = blockFor(".dish-poke .passage-content {");
  const pokeCtaBlock = blockFor(".dish-poke .dish-cta {");
  const floatingOrderBlock = blockFor(".floating-order {");
  const headerBlock = blockFor(".site-header {");

  assert.doesNotMatch(ctaBlock, /\bbackground(?:-color)?\s*:/);
  assert.match(hungryBlock, /color:\s*var\(--gold\)/);
  assert.match(hungryBlock, /text-align:\s*left/);
  assert.match(hungryBlock, /margin-right:\s*1\.45rem/);
  assert.match(navLinkBlock, /color:\s*var\(--gold\)/);
  assert.match(navLinkBlock, /-webkit-text-stroke:\s*0\.5px\s+rgba\(0, 0, 0, 1\)/);
  assert.match(navLinkBlock, /paint-order:\s*stroke fill/);
  assert.match(navLinkBlock, /border-bottom:\s*0\.15rem solid transparent/);
  assert.match(
    brandImgBlock,
    /drop-shadow\(0 0\.35rem 1rem rgba\(0, 0, 0, 0\.36\)\)/,
  );
  assert.match(brandImgBlock, /drop-shadow\(0\.65px 0 0 rgba\(0, 0, 0, 1\)\)/);
  assert.match(brandImgBlock, /drop-shadow\(-0\.65px 0 0 rgba\(0, 0, 0, 1\)\)/);
  assert.match(brandImgBlock, /drop-shadow\(0 0\.65px 0 rgba\(0, 0, 0, 1\)\)/);
  assert.match(brandImgBlock, /drop-shadow\(0 -0\.65px 0 rgba\(0, 0, 0, 1\)\)/);
  assert.doesNotMatch(brandImgBlock, /\b(?:background|box-shadow|outline|border)\s*:/);
  const cssWithoutHeaderNavStroke = css.replace(
    /nav a:not\(\.order-link\) \{[^}]*\}/,
    "",
  );
  assert.doesNotMatch(
    cssWithoutHeaderNavStroke,
    /-webkit-text-stroke|paint-order:/,
    "the micro black stroke must stay on header Menu/Instagram only",
  );
  assert.doesNotMatch(headerOrderBlock, /-webkit-text-stroke|paint-order:/);
  assert.doesNotMatch(orderBlock, /-webkit-text-stroke|paint-order:/);
  assert.doesNotMatch(floatingOrderBlock, /-webkit-text-stroke|paint-order:/);
  assert.doesNotMatch(ctaBlock, /-webkit-text-stroke|paint-order:/);
  assert.doesNotMatch(hungryBlock, /-webkit-text-stroke|paint-order:/);
  assert.match(locoHeadingBlock, /color:\s*var\(--gold\)/);
  assert.match(
    css,
    /\.visit-passage h2 span \{[\s\S]*?color:\s*var\(--leaf\)/,
  );
  assert.match(
    css,
    /\.visit-passage h2 strong \{[\s\S]*?color:\s*var\(--gold\)/,
  );
  assert.match(
    css,
    /\.visit-passage h2 strong \{[\s\S]*?font:\s*inherit/,
  );
  assert.match(
    css,
    /\.visit-passage h2 \{[\s\S]*?text-shadow:[\s\S]*?0 0\.06rem 0\.16rem rgba\(0, 0, 0, 0\.86\)/,
  );
  assert.doesNotMatch(css, /\.visit-passage h2 \{[\s\S]*?-webkit-text-stroke/);
  assert.match(
    css,
    /\.visit-address \{[\s\S]*?text-shadow:[\s\S]*?0 0\.06rem 0\.16rem rgba\(0, 0, 0, 0\.86\)/,
  );
  assert.match(
    css,
    /\.visit-address,[\s\S]*?\.visit-links a:visited \{[\s\S]*?color:\s*var\(--leaf\)/,
  );
  assert.match(pokeHeadingBlock, /color:\s*var\(--white\)/);
  assert.doesNotMatch(pokeHeadingBlock, /var\(--gold\)/);
  assert.doesNotMatch(
    css,
    /\.dish-poke \.passage-content \{[^}]*flex-direction:\s*column/,
    "Hungry Yet should sit beside Poke Bowl, not stack under it",
  );
  assert.match(pokeContentBlock, /justify-content:\s*space-between/);
  assert.match(pokeContentBlock, /padding-right:\s*0/);
  assert.match(pokeCtaBlock, /text-align:\s*right/);
  assert.doesNotMatch(css, /\.dish-cta a/);
  assert.doesNotMatch(css, /\.dish-poke \.dish-cta a/);
  assert.match(css, /h1,\s*h2,\s*\.dish-cta h3 \{[\s\S]*?font-family:\s*"Arial Black"/);
  assert.match(orderBlock, /font-family:\s*"Arial Black"/);
  assert.match(orderBlock, /color:\s*var\(--gold\)/);
  assert.match(orderBlock, /white-space:\s*nowrap/);
  assert.match(headerOrderBlock, /font-family:\s*"Arial Black"/);
  assert.match(headerOrderBlock, /background:\s*var\(--gold\)/);
  assert.match(headerOrderBlock, /color:\s*var\(--ink\)/);
  assert.match(headerOrderBlock, /border-radius:\s*999px/);
  assert.match(
    css,
    /\.order-link\s*>\s*span\s*\{[^}]*color:\s*var\(--green\)/s,
  );
  assert.match(floatingOrderBlock, /position:\s*fixed/);
  assert.match(floatingOrderBlock, /left:\s*50%/);
  assert.match(floatingOrderBlock, /border-radius:\s*999px/);
  assert.match(floatingOrderBlock, /padding:\s*1\.05rem 1\.7rem 1rem/);
  assert.match(
    floatingOrderBlock,
    /font-size:\s*clamp\(1\.05rem, 1\.4vw, 1\.25rem\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.floating-order \{[\s\S]*?padding:\s*0\.82rem 1\.2rem 0\.78rem;[\s\S]*?font-size:\s*1rem;/,
    "mobile keeps the compact floating-order treatment",
  );
  assert.match(
    css,
    /\.floating-order\s*>\s*span\s*\{[^}]*color:\s*var\(--green\)/s,
  );
  assert.doesNotMatch(html, /Meet the plate/);
  assert.doesNotMatch(css, /\.opening-next\b/);
  assert.ok(
    html.indexOf('class="floating-order"') <
      html.indexOf('class="smooth-scroll-wrapper"'),
    "the floating order pill must stay outside transformed passage content",
  );
  assert.match(headerBlock, /position:\s*fixed/);
  assert.match(headerBlock, /z-index:\s*20/);
  assert.match(
    css,
    /\.reduced-motion-sequence img \{\s*opacity: 1;\s*animation: none;/,
  );

  assert.match(html, /class="visit-address"/);
  assert.match(html, /6280 S Valley View Blvd/);
  assert.match(html, /class="visit-order"[^>]*>\s*Order now/);
  assert.match(html, /class="visit-links"[\s\S]*?Directions[\s\S]*?Instagram/);
  assert.match(html, /class="floating-order"/);

  const visitContentBase = blockFor(".visit-content {");
  assert.match(visitContentBase, /display:\s*flex/);
  assert.match(visitContentBase, /flex-direction:\s*column/);
  assert.match(visitContentBase, /justify-content:\s*flex-end/);
  assert.match(visitContentBase, /align-items:\s*center/);
  assert.match(visitContentBase, /text-align:\s*center/);
  assert.match(
    visitContentBase,
    /gap:\s*clamp\(2\.5rem,\s*11\.111vh,\s*7\.5rem\)/,
  );
  assert.match(
    visitContentBase,
    /padding-bottom:\s*clamp\(6\.5rem,\s*16\.963vh,\s*11\.45rem\)/,
  );
  assert.doesNotMatch(
    css,
    /\.visit-content\s*\{[^}]*display:\s*grid/,
    "no Visit grid display may remain",
  );
  assert.doesNotMatch(
    css,
    /grid-template-columns:/,
    "no Visit grid-template-columns may remain",
  );
  const desktopVisitBlocks = mediaBlocks("(min-width: 761px)");
  assert.ok(
    !desktopVisitBlocks.some((block) => /\.visit-content\s*\{/.test(block)),
    "no desktop Visit grid may remain under min-width 761px",
  );

  const visitTitleBlock = blockFor(".visit-passage h2 {\n  max-width: 7ch;");
  assert.match(visitTitleBlock, /max-width:\s*7ch/);
  assert.match(visitTitleBlock, /text-align:\s*center/);
  assert.match(visitTitleBlock, /display:\s*flex/);
  assert.match(visitTitleBlock, /flex-direction:\s*column/);
  assert.match(visitTitleBlock, /align-items:\s*center/);
  assert.match(
    visitTitleBlock,
    /gap:\s*clamp\(0\.18em,\s*8vh,\s*0\.54em\)/,
  );
  const visitTitleBreakBlock = blockFor(".visit-passage h2 br {");
  assert.match(visitTitleBreakBlock, /display:\s*none/);
  assert.match(
    css,
    /\.visit-passage h2 span,\s*\.visit-passage h2 strong \{\s*display:\s*block;/,
  );
  assert.doesNotMatch(
    css,
    /\.visit-passage h2 (?:span|strong)\s*\{[^}]*transform:/,
    "the Visit title rows must share the composition rhythm instead of independent offsets",
  );
  assert.doesNotMatch(
    css,
    /(?:^|})\s*(?:h1|h2|\.food-passage h2|\.dish-\S+ h2|\.dish-cta h3) br\s*\{/,
    "only the Visit title line break may be hidden",
  );
  assert.doesNotMatch(
    css,
    /(?:^|})\s*(?:h1|h2|\.food-passage h2|\.dish-\S+ h2|\.dish-cta h3)\s*\{[^}]*gap:\s*0\.12em/,
    "no global heading or dish title may receive the Visit title gap",
  );
  assert.doesNotMatch(
    css,
    /\.food-passage h2,\s*\.visit-passage h2 \{[^}]*gap:\s*0\.12em/,
    "the shared food/visit title rule must not receive the Visit title gap",
  );
  assert.doesNotMatch(locoHeadingBlock, /gap:\s*0\.12em/);
  assert.doesNotMatch(pokeHeadingBlock, /gap:\s*0\.12em/);
  assert.doesNotMatch(hungryBlock, /display:\s*none/);
  assert.doesNotMatch(hungryBlock, /gap:\s*0\.12em/);
  const visitActionsBase = blockFor(".visit-actions {");
  assert.match(visitActionsBase, /align-self:\s*center/);
  assert.match(visitActionsBase, /max-width:\s*33rem/);
  assert.match(visitActionsBase, /text-align:\s*center/);
  assert.doesNotMatch(
    visitActionsBase,
    /\b(?:background|background-color|background-image|box-shadow|border)\s*:/,
    "visit-actions must stay unpaneled on the photograph",
  );
  const visitLinksBlock = blockFor(".visit-links {");
  const visitAddressBlock = blockFor(".visit-address {");
  assert.match(visitLinksBlock, /justify-content:\s*center/);
  assert.match(visitLinksBlock, /gap:\s*1rem 2rem/);
  assert.match(
    visitAddressBlock,
    /font-size:\s*clamp\(1\.1rem,\s*1\.7vw,\s*1\.5rem\)/,
  );
  assert.match(
    orderBlock,
    /margin-top:\s*clamp\(1\.5rem,\s*6\.667vh,\s*4\.5rem\)/,
  );
  assert.match(
    visitLinksBlock,
    /margin-top:\s*clamp\(1\.5rem,\s*6\.667vh,\s*4\.5rem\)/,
  );

  const mobileVisitBlocks = mediaBlocks("(max-width: 760px)");
  assert.ok(
    mobileVisitBlocks.some((block) =>
      nestedBlocksFor(block, ".visit-content {").some(
        (visitMobile) =>
          /display:\s*flex/.test(visitMobile) &&
          /flex-direction:\s*column/.test(visitMobile) &&
          /align-items:\s*center/.test(visitMobile) &&
          /text-align:\s*center/.test(visitMobile) &&
          /gap:\s*clamp\(2\.65rem,\s*8svh,\s*4\.25rem\)/.test(
            visitMobile,
          ) &&
          /padding:\s*2\.1rem 1\.25rem clamp\(6\.8rem,\s*14svh,\s*8rem\)/.test(
            visitMobile,
          ),
      ),
    ),
    "the max-width 760px Visit rule must mirror the desktop centered spacing rhythm",
  );
  assert.ok(
    mobileVisitBlocks.every((block) =>
      nestedBlocksFor(block, ".visit-content {").every(
        (visitMobile) =>
          !/align-items:\s*stretch/.test(visitMobile) &&
          !/align-items:\s*flex-start/.test(visitMobile) &&
          !/text-align:\s*left/.test(visitMobile) &&
          !/display:\s*grid/.test(visitMobile),
      ),
    ),
    "the max-width 760px Visit rule must not restore stretch or left alignment",
  );
  assert.ok(
    mobileVisitBlocks.some((block) =>
      nestedBlocksFor(block, ".visit-passage h2 {").some((visitTitleMobile) =>
        /gap:\s*clamp\(0\.22em,\s*4\.4svh,\s*0\.38em\)/.test(
          visitTitleMobile,
        ),
      ),
    ),
    "the mobile Visit title must carry the spaced desktop line rhythm",
  );
  assert.ok(
    mobileVisitBlocks.some((block) =>
      nestedBlocksFor(block, ".visit-links {").some((visitLinksMobile) =>
        /margin-top:\s*clamp\(2\.15rem,\s*6\.5svh,\s*3\.25rem\)/.test(
          visitLinksMobile,
        ),
      ),
    ),
    "the mobile Visit links must stay separated from the primary order action",
  );
  assert.ok(
    !mediaBlocks("(max-width: 760px)").some((block) =>
      /grid-template-columns:/.test(block),
    ),
    "mobile rules must not define Visit grid tracks",
  );
});

// Focused tripwire: first-order offer climax and dish-carousel contract.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: maintainers changing the Generations Kitchen passage/export.
// Activation: execute `node --test tests/rendered-html.test.mjs` after
// `vinext build`.
// Behavioral check: exercises the generated export and rejects return of the
// Teri video beat, a short black hold, a second burst background, one-degree
// colored spokes, offer leak during the transition, visible chrome during
// black, beat-skipping while playing, or loss of the twelve menu images/links.
// The visitor contract is one master clock: slam to empty black, hold, a
// soft gold-white seed that only expands, destination field/rays staged
// under full exposure, then opacity-only reveal. Coupon, carousel, and
// chrome fade from that same clock and already match `settled` before the
// attribute changes.
// Retirement: only when the offer beat is intentionally removed or replaced
// and the corresponding production consumer contract changes.
test("exports the offer climax and first-party dish carousel", async () => {
  const html = await (await render()).text();
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const climaxSource = await readFile(
    new URL("../app/offer-climax.tsx", import.meta.url),
    "utf8",
  );

  assert.match(html, /data-scroll-beat="offer"/);
  assert.match(html, /\$10 OFF YOUR FIRST ORDER/);
  assert.match(html, /FIRST10/);
  assert.match(html, /\$30 MINIMUM/);
  assert.match(html, /Previous dishes/);
  assert.match(html, /Next dishes/);
  assert.match(
    html,
    /<a href="https:\/\/generationskitchenvegas\.com\/menu" target="_blank" rel="noreferrer">\s*Menu\s*<\/a>/,
  );
  assert.doesNotMatch(html, /<a href="#hurricane">Menu<\/a>/);

  for (const file of [
    "furikake-chicken.webp",
    "hurricane-chicken.webp",
    "garlic-chicken.webp",
    "hamburger-steak.webp",
    "loco-moco.webp",
    "teriyaki-beef.webp",
    "chicken-katsu.webp",
    "fried-chicken.webp",
    "teri-beef-fries.webp",
    "poke-bowl-spicy.webp",
    "poke-bowl-hawaiian.webp",
    "poke-nachos.webp",
  ]) {
    assert.match(html, new RegExp(`/media/menu/${file}`));
  }

  assert.equal(
    html.match(/class="offer-card"/g)?.length,
    12,
    "every distinct verified menu photograph should be represented once",
  );

  for (const href of [
    "furikake-chicken-BLaD",
    "hurricane-chicken-V3Ln",
    "garlic-chicken-9tBv",
    "hamburger-steak-7e8E",
    "loco-moco-mvzn",
    "teriyaki-beef-Nr2Q",
    "chicken-katsu-QqjI",
    "fried-chicken-u5Ss",
    "teri-beef-fries-sS8t",
    "poke-bowl-spicy-v2TB",
    "poke-bowl-hawaiian-xDrN",
    "poke-nachos-spicy-hGMI",
  ]) {
    assert.match(
      html,
      new RegExp(
        `https://generationskitchenvegas\\.com/menu\\?item=${href}`,
      ),
    );
  }

  const pokeStart = html.indexOf('id="poke-bowl"');
  const offerStart = html.indexOf('id="offer"');
  const visitStart = html.indexOf('id="visit"');
  const hungry = html.search(/HUNGRY[\s\S]*?YET\?/);
  assert.ok(
    pokeStart >= 0 &&
      hungry > pokeStart &&
      hungry < offerStart &&
      offerStart < visitStart,
    "HUNGRY YET? belongs on Poke, before the offer beat",
  );

  assert.ok(
    html.indexOf('class="offer-transition"') <
      html.indexOf('class="smooth-scroll-wrapper"'),
    "the offer transition must stay outside transformed passage content",
  );
  assert.match(html, /class="offer-transition"[^>]*pointer-events:\s*none/);
  assert.match(css, /\.offer-transition \{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.offer-passage \{/);
  assert.doesNotMatch(css, /\.offer-passage[^{]*\{[^}]*\b(?:filter|backdrop-filter)\s*:/);
  assert.match(climaxSource, /CLIMAX_DURATION_MS/);
  assert.match(climaxSource, /sampleOfferClimax\(/);
  assert.match(climaxSource, /requestAnimationFrame\(tickClimax\)/);
  assert.doesNotMatch(
    climaxSource,
    /climaxDurationMs = 2800|climaxDurationMs = 4400|climaxDurationMs = 4800/,
    "obsolete climax settle timers must not remain",
  );
  assert.doesNotMatch(
    css,
    /html\[data-offer-climax="playing"\][^{]*\{[^}]*\banimation\s*:/,
    "playing-state layers must not own a CSS keyframe clock",
  );
  assert.doesNotMatch(
    css,
    /offer-volume/,
    "blurred RGB volume layers must not remain",
  );
  assert.doesNotMatch(
    climaxSource,
    /offer-volume/,
    "the transition stack must not mount volume layers",
  );
  assert.match(html, /class="offer-detonation"/);
  assert.doesNotMatch(climaxSource, /buildDetonationGeometry\(/);
  assert.doesNotMatch(
    climaxSource,
    /wedges:|trails:|embers:|glints:/,
    "canvas must not keep a second star vocabulary of wedges, trails, rings, or embers",
  );
  assert.doesNotMatch(
    climaxSource,
    /strokeStyle|lineTo\(|context\.arc\(/,
    "transient ring, trail, and glint strokes must not remain",
  );
  assert.doesNotMatch(
    climaxSource,
    /addColorStop\(0\.82/,
    "the hard-rim white disc plateau must not remain",
  );
  assert.match(climaxSource, /EXPOSURE_OVERSCAN/);
  assert.match(climaxSource, /createRadialGradient/);
  assert.doesNotMatch(
    climaxSource,
    /whitePeakEnd/,
    "canvas must not wait on a hard white-peak threshold before drawing",
  );
  assert.match(climaxSource, /requestAnimationFrame\(tickClimax\)/);
  assert.match(climaxSource, /cancelAnimationFrame/);
  assert.match(climaxSource, /mobileOfferEnterRatio = 0\.08/);
  assert.doesNotMatch(
    climaxSource,
    /intersectionRatio >= 0\.28/,
    "the late mobile 0.28 entry threshold must not remain",
  );
  assert.doesNotMatch(
    css,
    /offer-shutter-close 4\.4s|offer-flash-white 4\.4s|offer-ray-erupt 4\.4s|offer-field-core 4\.4s/,
    "the obsolete 4.4s climax clock must not remain",
  );
  assert.doesNotMatch(
    css,
    /offer-shutter-close 2\.8s|offer-flash-white 2\.8s|offer-ray-erupt 2\.8s|offer-field-core 2\.8s/,
    "the obsolete 2.8s climax clock must not remain",
  );
  assert.doesNotMatch(
    css,
    /offer-shutter-close 1\.65s|offer-flash-line 1\.65s|offer-ray-erupt 1\.65s/,
    "the obsolete 1.65s shutoff clock must not remain",
  );
  assert.doesNotMatch(css, /\.offer-burst/, "a second burst background must not exist");
  assert.doesNotMatch(css, /@keyframes offer-ray-erupt/);
  assert.doesNotMatch(css, /@keyframes offer-shutter-close/);
  assert.doesNotMatch(css, /@keyframes offer-flash-white/);
  assert.doesNotMatch(css, /@keyframes offer-field-grow/);
  assert.doesNotMatch(css, /@keyframes offer-ray-afterlife/);
  assert.doesNotMatch(css, /@keyframes offer-field-core/);
  assert.doesNotMatch(css, /@keyframes offer-chrome-in/);
  assert.doesNotMatch(css, /@keyframes offer-content-in/);
  assert.doesNotMatch(css, /\.offer-shutter/);
  assert.doesNotMatch(css, /\.offer-flash/);
  assert.match(css, /\.offer-detonation \{[\s\S]*?z-index:\s*1;/);
  assert.match(
    css,
    /clip-path:\s*circle\(var\(--offer-field-clip, 0%\) at 50% 38%\)/,
    "the persistent field must grow from the shared origin on the master clock",
  );
  assert.match(
    css,
    /clip-path:\s*circle\(var\(--offer-ray-clip, 0%\) at 50% 38%\)/,
    "rays must be born from the shared origin instead of fading in at full length",
  );
  assert.match(
    css,
    /html\[data-offer-climax="settled"\] main\.force-motion \.offer-ray \{[\s\S]*?opacity:\s*0\.74;/,
    "settled rays must match the terminal sampled opacity",
  );
  assert.doesNotMatch(
    css,
    /filter:\s*blur\(/,
    "broad CSS blur volumes must stay absent from the climax",
  );
  assert.match(
    css,
    /html\[data-offer-climax="idle"\] main\.force-motion \.offer-field,[\s\S]*?\.offer-ray \{[\s\S]*?opacity:\s*0;/,
    "idle full-motion must not leak the settled field or rays",
  );
  assert.match(
    css,
    /html\[data-offer-climax="idle"\] main\.force-motion \.offer-content \{[\s\S]*?opacity:\s*0;/,
    "idle full-motion must not leak coupon or carousel",
  );
  assert.match(
    css,
    /\.offer-content \{[\s\S]*?opacity:\s*1;/,
    "attribute-absent static markup must show the finished offer",
  );
  assert.match(
    css,
    /\.offer-ray \{[\s\S]*?background:\s*repeating-conic-gradient\([\s\S]*?9deg 13deg[\s\S]*?28deg 32deg[\s\S]*?47deg 51deg/,
    "initial and settled rays must be broad, softly edged red, gold, and green beams",
  );
  assert.doesNotMatch(
    css,
    /12deg 13deg|24deg 25deg|36deg 37deg/,
    "the old one-degree colored spokes must not return",
  );
  assert.match(css, /\.offer-field::after \{[\s\S]*?radial-gradient\(/);
  assert.match(
    css,
    /\.offer-field::after \{[\s\S]*?opacity:\s*0;/,
    "terminal origin flare must match the settled CSS opacity",
  );
  assert.match(css, /\.offer-field \{[\s\S]*?opacity:\s*1;/);
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] main\.force-motion \.offer-content \{[\s\S]*?var\(--offer-content-opacity, 0\)/,
    "coupon and carousel must stay at zero until the master clock reveals them",
  );
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] main\.force-motion \.site-header,[\s\S]*?\.floating-order \{[\s\S]*?var\(--offer-chrome-opacity, 0\)/,
    "logo, nav, and floating order must leave the empty black world",
  );
  assert.match(
    css,
    /html\[data-offer-climax="settled"\] main\.force-motion \.site-header,[\s\S]*?opacity:\s*1;/,
    "chrome must already equal the terminal sampled frame at settled",
  );
  assert.match(
    css,
    /html\[data-offer-climax="settled"\] \.offer-content,[\s\S]*?opacity:\s*1;/,
    "coupon and carousel must already equal the terminal sampled frame at settled",
  );
  assert.match(climaxSource, /function lockOfferClimaxInput/);
  assert.match(
    climaxSource,
    /addEventListener\("wheel", lockOfferClimaxInput, \{\s*capture:\s*true,\s*passive:\s*false/,
  );
  assert.match(
    climaxSource,
    /addEventListener\("touchmove", lockOfferClimaxInput, \{\s*capture:\s*true,\s*passive:\s*false/,
  );
  assert.match(
    climaxSource,
    /addEventListener\("keydown", lockOfferClimaxInput, \{ capture: true \}/,
  );
  assert.match(climaxSource, /removeEventListener\("wheel", lockOfferClimaxInput/);
  assert.match(climaxSource, /removeEventListener\("touchmove", lockOfferClimaxInput/);
  assert.match(climaxSource, /removeEventListener\("keydown", lockOfferClimaxInput/);
  assert.match(
    climaxSource,
    /if \(prefersExplicitReducedMotion\(\)\) \{\s*detachLock\(\);\s*stopClimaxClock\(\);\s*setClimax\("settled"\);/,
    "reduced motion must skip the climax clock and input lock",
  );
  assert.match(
    css,
    /html\[data-offer-climax="settled"\] main\.force-motion \.offer-action \{[\s\S]*?offer-action-breathe 2\.8s 0\.72s ease-in-out infinite/,
  );
  assert.match(css, /\.offer-terms \{[\s\S]*?font-size:\s*1rem;/);
  assert.match(
    css,
    /\.offer-content \{[\s\S]*?min-width:\s*0;/,
    "the carousel must not widen the offer content past the mobile viewport",
  );
  assert.match(css, /\.offer-carousel \{[\s\S]*?max-width:\s*100%;/);
  assert.match(
    css,
    /@media \(max-width: 760px\) \{[\s\S]*?\.offer-action \{[\s\S]*?font-size:\s*clamp\(1rem, 4\.7vw, 1\.15rem\);/,
    "the complete coupon line must fit a representative mobile viewport",
  );
  assert.match(
    css,
    /@media \(max-width: 760px\) \{[\s\S]*?\.offer-terms \{[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.match(css, /\.offer-track \{[\s\S]*?scrollbar-width:\s*none;/);
  assert.match(css, /\.offer-track::-webkit-scrollbar \{[\s\S]*?display:\s*none;/);
  assert.match(css, /\.offer-track \{[\s\S]*?touch-action:\s*pan-x pan-y;/);
  assert.doesNotMatch(
    css,
    /\.offer-track \{[^}]*overscroll-behavior-y:\s*none/,
    "vertical swipes that start on the carousel must be able to leave the beat",
  );
  assert.match(
    css,
    /\.offer-card \{[\s\S]*?scroll-snap-align:\s*center;[\s\S]*?scroll-snap-stop:\s*always;/,
    "each card must snap to the track center and stop there",
  );
  assert.match(
    css,
    /\.offer-track::before,[\s\S]*?\.offer-track::after \{[\s\S]*?flex:\s*0 0 calc\(\(100% - var\(--offer-card-width\)\) \/ 2\)/,
    "side spacers must let the first and last cards rest at center",
  );
  assert.match(css, /\.offer-card span \{[\s\S]*?text-align:\s*center;/);
  assert.match(
    climaxSource,
    /cardCenter - trackCenter/,
    "arrow and wheel steps must aim at the card center, not its left edge",
  );
  assert.match(
    climaxSource,
    /stepOfferCarousel\(/,
    "desktop arrows must step the selected DOM index through the shared helper",
  );
  assert.match(climaxSource, /selectedIndexRef/);
  assert.match(climaxSource, /pendingIndexRef/);
  assert.match(climaxSource, /programmaticRef/);
  assert.match(climaxSource, /resyncOfferCarouselFromUserScroll\(/);
  assert.doesNotMatch(
    climaxSource,
    /track\.scrollBy\s*\(|scrollByCard\s*\(/,
    "relative multi-card scrollBy jumps must not return",
  );
  assert.doesNotMatch(
    climaxSource,
    /innerWidth|offsetWidth|clientWidth\s*[+*]/,
    "carousel steps must not use viewport or page-sized jumps",
  );
  assert.match(
    climaxSource,
    /scrollWidth\s*-\s*track\.clientWidth/,
    "physical scrollTo must clamp to the real scroll range",
  );
  assert.match(
    climaxSource,
    /offerWheelGestureDecision\(/,
    "horizontal wheel/trackpad gestures must reuse the one-card decision helper",
  );
  assert.match(
    climaxSource,
    /addEventListener\("wheel", onWheel, \{ passive: false \}\)/,
  );
  assert.doesNotMatch(
    climaxSource,
    /function onWheel\([\s\S]*?stopPropagation/,
    "settled carousel vertical wheel intent must keep bubbling so the visitor can leave the beat",
  );
  assert.match(climaxSource, /data-active-scroll-beat/);
  assert.match(climaxSource, /IntersectionObserver/);
  assert.match(climaxSource, /motion"\) === "reduced"/);
  assert.match(pageSource, /motion !== "reduced" \? "force-motion"/);

  for (const file of [
    "public/media/menu/furikake-chicken.webp",
    "public/media/menu/hurricane-chicken.webp",
    "public/media/menu/garlic-chicken.webp",
    "public/media/menu/hamburger-steak.webp",
    "public/media/menu/loco-moco.webp",
    "public/media/menu/teriyaki-beef.webp",
    "public/media/menu/chicken-katsu.webp",
    "public/media/menu/fried-chicken.webp",
    "public/media/menu/teri-beef-fries.webp",
    "public/media/menu/poke-bowl-spicy.webp",
    "public/media/menu/poke-bowl-hawaiian.webp",
    "public/media/menu/poke-nachos.webp",
  ]) {
    const url = new URL(file, projectRoot);
    await access(url);
    const info = await stat(url);
    assert.ok(info.size > 1_000, `${file} should be a real menu photograph`);
  }
});

// Focused tripwire: offer-carousel DOM sequence in the generated export.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: maintainers changing offerDishes in app/page.tsx.
// Activation: execute `node --test tests/rendered-html.test.mjs` after
// `vinext build`.
// Behavioral check: inspects offer-track card render order in the exported
// HTML, not a whole-page string search. The first five cards must be
// Hurricane Chicken, Loco Moco, Spicy Poke Bowl, Teri Beef Fries,
// Furikake Chicken; all twelve existing names, links, and images remain
// present exactly once, with the remaining seven in their prior relative
// order.
// Retirement: when the owner intentionally changes the carousel sequence.
test("renders the offer-carousel cards in the approved sequence", async () => {
  const html = await (await render()).text();
  const trackOpen = html.indexOf('<div class="offer-track">');
  assert.ok(trackOpen >= 0, "the export must render the offer-track");
  const trackClose = html.indexOf("</div>", trackOpen);
  assert.ok(trackClose > trackOpen, "the offer-track must close");
  const trackHtml = html.slice(trackOpen, trackClose);
  const cards = [
    ...trackHtml.matchAll(
      /<a class="offer-card" href="([^"]+)"[^>]*>\s*<img src="([^"]+)" alt="([^"]+)"\s*\/?>\s*<span>([^<]*)<\/span>\s*<\/a>/g,
    ),
  ].map((match) => ({
    href: match[1],
    src: match[2],
    alt: match[3],
    name: match[4],
  }));

  const expected = [
    {
      name: "Hurricane Chicken",
      src: "/media/menu/hurricane-chicken.webp",
      href: "https://generationskitchenvegas.com/menu?item=hurricane-chicken-V3Ln",
    },
    {
      name: "Loco Moco",
      src: "/media/menu/loco-moco.webp",
      href: "https://generationskitchenvegas.com/menu?item=loco-moco-mvzn",
    },
    {
      name: "Spicy Poke Bowl",
      src: "/media/menu/poke-bowl-spicy.webp",
      href: "https://generationskitchenvegas.com/menu?item=poke-bowl-spicy-v2TB",
    },
    {
      name: "Teri Beef Fries",
      src: "/media/menu/teri-beef-fries.webp",
      href: "https://generationskitchenvegas.com/menu?item=teri-beef-fries-sS8t",
    },
    {
      name: "Furikake Chicken",
      src: "/media/menu/furikake-chicken.webp",
      href: "https://generationskitchenvegas.com/menu?item=furikake-chicken-BLaD",
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

  assert.equal(
    cards.length,
    12,
    "the offer-track must render all twelve existing cards in document order",
  );
  assert.deepEqual(
    cards.slice(0, 5).map((card) => card.name),
    [
      "Hurricane Chicken",
      "Loco Moco",
      "Spicy Poke Bowl",
      "Teri Beef Fries",
      "Furikake Chicken",
    ],
    "the offer-track prefix must be the approved five-card sequence",
  );
  assert.deepEqual(
    cards.map(({ href, src, name }) => ({ href, src, name })),
    expected,
    "every existing card name, link, and image must remain present exactly once in render order",
  );
  assert.equal(new Set(cards.map((card) => card.name)).size, 12);
  assert.equal(new Set(cards.map((card) => card.href)).size, 12);
  assert.equal(new Set(cards.map((card) => card.src)).size, 12);
  for (const card of cards) {
    assert.equal(card.alt, card.name);
  }
});

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readCssBlock(css, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { block: css.slice(openIndex + 1, index), end: index + 1 };
      }
    }
  }
  return { block: "", end: css.length };
}

function parseCssRules(css) {
  const source = stripCssComments(css);
  const rules = [];
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("{", index);
    if (start === -1) break;
    const prelude = source.slice(index, start).trim();
    const { block, end } = readCssBlock(source, start);
    if (prelude.startsWith("@keyframes")) {
      rules.push({
        type: "keyframes",
        name: prelude.replace(/^@keyframes\s+/, "").trim(),
        block,
      });
    } else if (!prelude.startsWith("@")) {
      rules.push({ type: "style", prelude, block });
    }
    index = end;
  }
  return rules;
}

function parseDeclarations(block) {
  const declarations = {};
  for (const part of block.split(";")) {
    const separator = part.indexOf(":");
    if (separator === -1) continue;
    const property = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (property) declarations[property] = value;
  }
  return declarations;
}

function parseKeyframes(block) {
  const frames = [];
  let index = 0;
  while (index < block.length) {
    const start = block.indexOf("{", index);
    if (start === -1) break;
    const keys = block
      .slice(index, start)
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    const { block: body, end } = readCssBlock(block, start);
    const declarations = parseDeclarations(body);
    for (const key of keys) {
      const percent =
        key === "from" ? 0 : key === "to" || key === "100%" ? 100 : Number.parseFloat(key);
      if (Number.isFinite(percent)) frames.push({ percent, declarations });
    }
    index = end;
  }
  return frames.sort((left, right) => left.percent - right.percent);
}

function specificity(selector) {
  return [
    (selector.match(/#/g) ?? []).length,
    (selector.match(/\.|\[|:(?!:)/g) ?? []).length,
    (selector.match(/(^|[\s>+~])[a-zA-Z]/g) ?? []).length,
  ];
}

function compareSpecificity(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function selectorMatches(selector, env) {
  const normalized = selector.replace(/\s+/g, " ").trim();
  const classToken = `.${env.className}`;
  if (!normalized.includes(classToken)) return false;
  const last = normalized.split(" ").at(-1) ?? "";
  if (!last.includes(classToken)) return false;
  if (last.includes(`${classToken}:`) || last.includes(`${classToken}::`)) return false;

  const climax = normalized.match(/data-offer-climax=["']?(\w+)/)?.[1];
  if (normalized.includes("data-offer-climax") && climax !== env.climax) {
    return false;
  }
  if (normalized.includes("main.force-motion") && !env.forceMotion) return false;
  if (normalized.includes("main:not(.force-motion)") && env.forceMotion) {
    return false;
  }
  return true;
}

const animationKeywords = new Set([
  "none",
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "forwards",
  "backwards",
  "both",
  "infinite",
  "alternate",
  "normal",
  "reverse",
  "paused",
  "running",
]);

function animationName(value) {
  return (
    value
      .split(/[\s,]+/)
      .filter(Boolean)
      .find(
        (token) =>
          !animationKeywords.has(token) &&
          !/^[\d.]/.test(token) &&
          !token.includes("(") &&
          /^[a-zA-Z_-]/.test(token),
      ) ?? null
  );
}

function computedLayerOpacity(css, env) {
  const rules = parseCssRules(css);
  const keyframes = new Map(
    rules
      .filter((rule) => rule.type === "keyframes")
      .map((rule) => [rule.name, parseKeyframes(rule.block)]),
  );

  let winner = {
    order: -1,
    specificity: [0, 0, 0],
    opacity: env.className === "offer-ray" ? "0.74" : "1",
    animation: null,
    fill: "",
  };

  rules.forEach((rule, order) => {
    if (rule.type !== "style") return;
    for (const selector of rule.prelude.split(",")) {
      if (!selectorMatches(selector, env)) continue;
      const declarations = parseDeclarations(rule.block);
      const spec = specificity(selector);
      if (
        compareSpecificity(spec, winner.specificity) < 0 ||
        (compareSpecificity(spec, winner.specificity) === 0 && order < winner.order)
      ) {
        continue;
      }
      winner = {
        order,
        specificity: spec,
        opacity: declarations.opacity ?? winner.opacity,
        animation: declarations.animation
          ? animationName(declarations.animation)
          : winner.animation,
        fill: declarations.animation ?? winner.fill,
      };
    }
  });

  if (winner.animation && keyframes.has(winner.animation)) {
    const frames = keyframes.get(winner.animation);
    const useEnd =
      env.phase === "end" && /\b(?:forwards|both)\b/.test(winner.fill);
    const frame = useEnd
      ? [...frames].reverse().find((item) => item.declarations.opacity)
      : frames.find((item) => item.declarations.opacity);
    if (frame?.declarations.opacity) return frame.declarations.opacity;
  }

  return winner.opacity;
}

function parseOpacity(value) {
  const raw = String(value ?? "").trim();
  const fallback = raw.match(/^var\([^,]+,\s*(.+)\)$/);
  return Number.parseFloat(fallback ? fallback[1].trim() : raw);
}

async function readBuiltStylesheet() {
  const html = await readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );
  const href = html.match(/href="(\/assets\/index-[^"]+\.css)"/)?.[1];
  if (!href) return null;
  return readFile(new URL(`../dist/client${href}`, import.meta.url), "utf8");
}

function assertOfferVisibilityTable(css, label) {
  const cases = [
    ["absent", true, "start", { field: 1, ray: 0.74, content: 1, header: 1 }],
    ["idle", true, "start", { field: 0, ray: 0, content: 0, header: 1 }],
    ["playing", true, "start", { field: 0, ray: 0, content: 0, header: 0 }],
    ["settled", true, "end", { field: 1, ray: 0.74, content: 1, header: 1 }],
    ["absent", false, "start", { field: 1, ray: 0.74, content: 1, header: 1 }],
    ["idle", false, "start", { field: 1, ray: 0.74, content: 1, header: 1 }],
    ["playing", false, "start", { field: 1, ray: 0.74, content: 1, header: 1 }],
    ["settled", false, "end", { field: 1, ray: 0.74, content: 1, header: 1 }],
  ];

  for (const [climax, forceMotion, phase, expected] of cases) {
    const env = { climax: climax === "absent" ? null : climax, forceMotion, phase };
    const actual = {
      field: parseOpacity(
        computedLayerOpacity(css, { ...env, className: "offer-field" }),
      ),
      ray: parseOpacity(
        computedLayerOpacity(css, { ...env, className: "offer-ray" }),
      ),
      content: parseOpacity(
        computedLayerOpacity(css, { ...env, className: "offer-content" }),
      ),
      header: parseOpacity(
        computedLayerOpacity(css, { ...env, className: "site-header" }),
      ),
    };
    assert.deepEqual(
      actual,
      expected,
      `${label} ${climax}/${forceMotion ? "force-motion" : "reduced"} must keep ${JSON.stringify(expected)}`,
    );
  }
}

// Focused tripwire: offer climax visibility, stack, and phase order.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: maintainers changing the poke-to-offer handoff.
// Activation: execute `node --test tests/rendered-html.test.mjs`.
// Behavioral check: idle/pre-entry cannot leak the finished world; attribute-
// absent markup stays readable; reduced motion stays settled; one RAF clock
// owns in-flight pixels; blur volumes stay gone; black -> seed -> beyond-
// frame exposure -> opacity reveal of the already-settled field -> content
// remains the clock. Retire when the offer climax is replaced.
test("keeps the offer climax from leaking, stacking, or blurring", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const climaxSource = await readFile(
    new URL("../app/offer-climax.tsx", import.meta.url),
    "utf8",
  );

  for (const rule of parseCssRules(css)) {
    if (
      rule.type === "style" &&
      rule.prelude.includes('data-offer-climax="playing"')
    ) {
      assert.doesNotMatch(
        rule.block,
        /\banimation\s*:/,
        "playing-state CSS must not start a keyframe clock",
      );
    }
  }
  assertOfferVisibilityTable(css, "source");
  const built = await readBuiltStylesheet();
  if (
    built &&
    (built.includes("data-offer-climax=idle") ||
      built.includes('data-offer-climax="idle"'))
  ) {
    assertOfferVisibilityTable(built, "built");
    assert.doesNotMatch(built, /filter:blur\(/);
    assert.doesNotMatch(built, /offer-volume/);
    assert.doesNotMatch(built, /offer-shutter-close|offer-flash-white/);
  }

  assert.match(
    climaxSource,
    /className="offer-detonation"/,
    "one full-viewport canvas must own shutter, black, and the soft exposure",
  );
  assert.doesNotMatch(climaxSource, /offer-shutter|offer-flash/);
  assert.match(climaxSource, /if \(prefersExplicitReducedMotion\(\)\) setClimax\("settled"\)/);
  assert.match(
    climaxSource,
    /if \(prefersExplicitReducedMotion\(\)\) \{\s*detachLock\(\);\s*stopClimaxClock\(\);\s*setClimax\("settled"\);/,
  );
  assert.match(climaxSource, /applyClimaxSample\(html, SETTLED_SAMPLE\)/);
  assert.match(
    climaxSource,
    /applyClimaxSample\(html, SETTLED_SAMPLE\);[\s\S]*?hideCompositor\(\);[\s\S]*?setClimax\("settled"\)/,
    "the terminal sampled frame must land before the overlay hides or settled is set",
  );
  assert.doesNotMatch(
    climaxSource,
    /setTimeout\([\s\S]*?setClimax\("settled"\)/,
    "settled must come from the master clock, not a parallel timer",
  );
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] main\.force-motion \.offer-field \{[\s\S]*?--offer-field-opacity/,
    "the field must finish under the master clock before content becomes readable",
  );
  assert.match(
    css,
    /html\[data-offer-climax="settled"\] \.offer-content,[\s\S]*?opacity:\s*1;/,
  );
});

// Focused tripwire: one master-clock offer-climax sampler.
// Canonical path: tests/rendered-html.test.mjs plus app/offer-climax-timeline.mjs.
// Future consumer: maintainers changing the poke-to-offer motion.
// Activation: execute `node --test tests/rendered-html.test.mjs`.
// Behavioral check: the pure sampler clamps, stays in range, stays C0/C1 at
// every declared phase boundary, keeps exposure radius monotonic, stages
// field/ray geometry before exposure opacity clears, and ends exactly on
// the static settled CSS state. Retire when the one-clock climax is
// intentionally replaced.
test("samples the offer climax from one continuous master clock", () => {
  assert.ok(CLIMAX_DURATION_MS >= 4210 && CLIMAX_DURATION_MS <= 4330);
  assert.ok(PHASE_MS.shutter >= 350 && PHASE_MS.shutter <= 400);
  assert.ok(PHASE_MS.blackHold >= 180 && PHASE_MS.blackHold <= 200);
  assert.equal(
    PHASE_MS.blackHold,
    190,
    "black hold must be exactly half of the prior 380ms plateau",
  );
  assert.equal(
    Object.values(PHASE_MS).reduce((sum, value) => sum + value, 0),
    CLIMAX_DURATION_MS,
  );

  assert.deepEqual(sampleOfferClimax(-1), { ...START_SAMPLE });
  assert.deepEqual(sampleOfferClimax(0), { ...START_SAMPLE });
  assert.deepEqual(sampleOfferClimax(Number.NaN), { ...START_SAMPLE });
  assert.deepEqual(sampleOfferClimax(1), { ...SETTLED_SAMPLE });
  assert.deepEqual(sampleOfferClimax(2), { ...SETTLED_SAMPLE });

  const probes = [
    -1,
    0,
    ...PHASE_BOUNDARIES,
    (PHASES.shutterCloseEnd + PHASES.blackHoldEnd) / 2,
    (PHASES.blackHoldEnd + PHASES.whitePeak) / 2,
    (PHASES.releaseStart + PHASES.fieldOwn) / 2,
    (PHASES.fieldOwn + PHASES.end) / 2,
    1,
    2,
    Number.NaN,
  ];
  for (const progress of probes) {
    const sample = sampleOfferClimax(progress);
    for (const key of SAMPLE_KEYS) {
      const value = sample[key];
      const [min, max] = SAMPLE_RANGES[key];
      assert.ok(Number.isFinite(value), `${key} must stay finite at ${progress}`);
      assert.ok(
        value >= min - 1e-12 && value <= max + 1e-12,
        `${key}=${value} must stay in [${min}, ${max}] at ${progress}`,
      );
    }
  }

  const jumpLimit = {
    fieldClip: 0.05,
    rayClip: 0.05,
    contentY: 0.01,
  };
  const velocityLimit = {
    fieldClip: 12,
    rayClip: 12,
    contentY: 8,
  };
  for (const boundary of PHASE_BOUNDARIES) {
    const left = sampleOfferClimax(boundary - 1e-5);
    const right = sampleOfferClimax(boundary + 1e-5);
    for (const key of SAMPLE_KEYS) {
      if (key === "progress") continue;
      const limit = jumpLimit[key] ?? 1e-3;
      assert.ok(
        Math.abs(left[key] - right[key]) <= limit,
        `${key} must not jump at ${boundary}: ${left[key]} -> ${right[key]}`,
      );
    }

    if (boundary <= 0 || boundary >= 1) continue;
    const dt = 1e-4;
    const before = sampleOfferClimax(boundary - dt);
    const at = sampleOfferClimax(boundary);
    const after = sampleOfferClimax(boundary + dt);
    for (const key of SAMPLE_KEYS) {
      if (key === "progress") continue;
      const leftVelocity = (at[key] - before[key]) / dt;
      const rightVelocity = (after[key] - at[key]) / dt;
      const limit = velocityLimit[key] ?? 6;
      assert.ok(
        Math.abs(rightVelocity - leftVelocity) <= limit,
        `${key} velocity must stay continuous at ${boundary}: ${leftVelocity} -> ${rightVelocity}`,
      );
    }
  }

  assert.equal(sampleOfferClimax(PHASES.shutterCloseEnd).black, 1);
  assert.equal(sampleOfferClimax(PHASES.blackHoldEnd).black, 1);
  assert.equal(
    sampleOfferClimax((PHASES.shutterCloseEnd + PHASES.blackHoldEnd) / 2).black,
    1,
  );
  assert.equal(sampleOfferClimax(PHASES.blackHoldEnd).white, 0);
  assert.equal(sampleOfferClimax(PHASES.blackHoldEnd).ignition, 0);
  assert.equal(sampleOfferClimax(PHASES.blackHoldEnd).whiteRadius, 0);
  assert.ok(sampleOfferClimax(PHASES.blackHoldEnd + 0.02).white > 0);
  assert.ok(sampleOfferClimax(PHASES.blackHoldEnd + 0.02).whiteRadius > 0);
  assert.ok(sampleOfferClimax(PHASES.blackHoldEnd + 0.02).whiteRadius < 1);
  assert.equal(sampleOfferClimax(PHASES.blackHoldEnd + 0.02).field, 0);
  assert.ok(sampleOfferClimax(PHASES.whitePeak).white > 0.999);
  assert.equal(
    sampleOfferClimax(PHASES.whitePeak).whiteRadius,
    TERMINAL_EXPOSURE_RADIUS,
  );
  assert.equal(sampleOfferClimax(PHASES.whitePeak).field, 0);
  assert.equal(sampleOfferClimax(PHASES.whitePeak).fieldClip, 0);
  assert.ok(EXPOSURE_OVERSCAN * TERMINAL_EXPOSURE_RADIUS > 1);

  assert.equal(sampleOfferClimax(PHASES.releaseStart).white, 1);
  assert.equal(
    sampleOfferClimax(PHASES.releaseStart).whiteRadius,
    TERMINAL_EXPOSURE_RADIUS,
  );
  assert.equal(sampleOfferClimax(PHASES.releaseStart).field, 1);
  assert.equal(sampleOfferClimax(PHASES.releaseStart).rays, SETTLED_RAY_OPACITY);
  assert.equal(
    sampleOfferClimax(PHASES.releaseStart).fieldClip,
    SETTLED_FIELD_CLIP,
  );
  assert.equal(sampleOfferClimax(PHASES.releaseStart).rayClip, SETTLED_RAY_CLIP);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).field, 1);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).rays, SETTLED_RAY_OPACITY);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).fieldClip, SETTLED_SAMPLE.fieldClip);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).rayClip, SETTLED_SAMPLE.rayClip);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).white, 0);
  assert.equal(
    sampleOfferClimax(PHASES.fieldOwn).whiteRadius,
    TERMINAL_EXPOSURE_RADIUS,
  );

  const midRelease = sampleOfferClimax(
    (PHASES.releaseStart + PHASES.fieldOwn) / 2,
  );
  assert.ok(midRelease.white < 0.6);
  assert.equal(midRelease.whiteRadius, TERMINAL_EXPOSURE_RADIUS);
  assert.equal(midRelease.field, 1);
  assert.equal(midRelease.fieldClip, SETTLED_FIELD_CLIP);
  assert.equal(midRelease.rayClip, SETTLED_RAY_CLIP);
  assert.equal(midRelease.transient, 0);

  assert.equal(sampleOfferClimax(PHASES.releaseStart).transient, 0);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).transient, 0);

  let previousRadius = 0;
  let covered = false;
  const steps = 400;
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const sample = sampleOfferClimax(progress);
    if (progress >= PHASES.blackHoldEnd) {
      assert.ok(
        sample.whiteRadius + 1e-12 >= previousRadius,
        `exposure radius must be monotonic at ${progress}: ${previousRadius} -> ${sample.whiteRadius}`,
      );
      previousRadius = sample.whiteRadius;
    }
    if (exposureCoversFrame(sample.whiteRadius)) {
      covered = true;
    }
    if (covered) {
      assert.ok(
        exposureCoversFrame(sample.whiteRadius),
        `full-frame coverage must not be lost at ${progress}`,
      );
    }
    if (progress >= PHASES.releaseStart) {
      assert.equal(sample.fieldClip, SETTLED_FIELD_CLIP);
      assert.equal(sample.rayClip, SETTLED_RAY_CLIP);
      assert.equal(sample.field, 1);
      assert.equal(sample.rays, SETTLED_RAY_OPACITY);
      assert.equal(sample.whiteRadius, TERMINAL_EXPOSURE_RADIUS);
    }
    if (exposureCoversFrame(sample.whiteRadius) && sample.white < 0.35) {
      assert.equal(sample.fieldClip, SETTLED_FIELD_CLIP);
      assert.equal(sample.rayClip, SETTLED_RAY_CLIP);
      assert.equal(sample.field, 1);
      assert.equal(sample.rays, SETTLED_RAY_OPACITY);
    }
  }
  assert.ok(covered, "exposure must reach full-frame coverage");

  const hide = sampleOfferClimax(PHASES.fieldOwn);
  assert.equal(hide.compositor, 0);
  assert.equal(hide.field, SETTLED_SAMPLE.field);
  assert.equal(hide.fieldClip, SETTLED_SAMPLE.fieldClip);
  assert.equal(hide.fieldScale, SETTLED_SAMPLE.fieldScale);
  assert.equal(hide.rays, SETTLED_SAMPLE.rays);
  assert.equal(hide.rayClip, SETTLED_SAMPLE.rayClip);
  assert.equal(hide.rayScale, SETTLED_SAMPLE.rayScale);
  assert.equal(hide.white, SETTLED_SAMPLE.white);
  assert.equal(hide.whiteRadius, SETTLED_SAMPLE.whiteRadius);

  assert.equal(sampleOfferClimax(PHASES.fieldOwn).content, 0);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).chrome, 0);
  assert.equal(sampleOfferClimax(PHASES.fieldOwn).contentY, CONTENT_Y_START);
  assert.equal(sampleOfferClimax(1).content, 1);
  assert.equal(sampleOfferClimax(1).chrome, 1);
  assert.equal(sampleOfferClimax(1).contentY, 0);
  assert.equal(sampleOfferClimax(1).compositor, 0);
  assert.equal(sampleOfferClimax(1).whiteRadius, TERMINAL_EXPOSURE_RADIUS);
  assert.deepEqual(sampleOfferClimax(1), { ...SETTLED_SAMPLE });
});

// Focused tripwire: one-card offer-carousel navigation.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: maintainers changing OfferMenuTrack or offer-carousel-nav.
// Activation: execute `node --test tests/rendered-html.test.mjs`.
// Behavioral check: walks the real helper through 0..11 and 11..0 on
// realistic geometry whose maxScrollLeft is below the last raw offsets,
// clamps only the physical target, rejects page-width jumps, and ignores a
// second step while pending. Retire when the offer carousel is removed or
// its one-card contract is intentionally replaced.
test("advances the offer carousel one measured card at a time", () => {
  const offsets = [
    0, 173, 401, 588, 910, 1095, 1322, 1500, 1788, 1961, 2210, 2444,
  ];
  const maxScrollLeft = offsets[8];
  assert.equal(offsets.length, 12);
  assert.ok(maxScrollLeft < offsets[9]);
  assert.ok(maxScrollLeft < offsets[10]);
  assert.ok(maxScrollLeft < offsets[11]);
  assert.equal(nearestOfferCardIndex(maxScrollLeft, offsets), 8);

  const forward = [0];
  let selectedIndex = 0;
  let scrollLeft = 0;
  for (let step = 0; step < 20; step += 1) {
    const next = adjacentOfferCardTarget({
      selectedIndex,
      offsets,
      direction: 1,
      maxScrollLeft,
    });
    assert.equal(
      next.scrollLeft,
      Math.min(offsets[next.index], maxScrollLeft),
      "physical target must be the adjacent offset clamped to maxScrollLeft",
    );
    assert.ok(next.scrollLeft <= maxScrollLeft);
    assert.notEqual(next.scrollLeft, 1200);
    assert.ok(
      next.index === selectedIndex || next.index === selectedIndex + 1,
      "next must stay on the current card or move exactly one card forward",
    );
    if (next.index === selectedIndex) break;
    selectedIndex = next.index;
    scrollLeft = next.scrollLeft;
    forward.push(selectedIndex);
  }
  assert.deepEqual(forward, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(scrollLeft, maxScrollLeft);

  const reverse = [11];
  selectedIndex = 11;
  scrollLeft = maxScrollLeft;
  for (let step = 0; step < 20; step += 1) {
    const previous = adjacentOfferCardTarget({
      selectedIndex,
      offsets,
      direction: -1,
      maxScrollLeft,
    });
    assert.equal(
      previous.scrollLeft,
      Math.min(offsets[previous.index], maxScrollLeft),
    );
    assert.ok(
      previous.index === selectedIndex || previous.index === selectedIndex - 1,
      "previous must stay on the current card or move exactly one card back",
    );
    if (previous.index === selectedIndex) break;
    selectedIndex = previous.index;
    scrollLeft = previous.scrollLeft;
    reverse.push(selectedIndex);
  }
  assert.deepEqual(reverse, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.equal(scrollLeft, offsets[0]);

  assert.deepEqual(
    adjacentOfferCardTarget({
      selectedIndex: 0,
      offsets,
      direction: -1,
      maxScrollLeft,
    }),
    { index: 0, scrollLeft: offsets[0] },
  );
  assert.deepEqual(
    adjacentOfferCardTarget({
      selectedIndex: 11,
      offsets,
      direction: 1,
      maxScrollLeft,
    }),
    { index: 11, scrollLeft: maxScrollLeft },
  );
  assert.deepEqual(
    adjacentOfferCardTarget({
      selectedIndex: 8,
      offsets,
      direction: 1,
      maxScrollLeft,
    }),
    { index: 9, scrollLeft: maxScrollLeft },
  );

  let state = {
    selectedIndex: 0,
    scrollLeft: 0,
    pendingIndex: null,
    offsets,
    maxScrollLeft,
  };
  const afterFirst = stepOfferCarousel(state, 1);
  assert.equal(afterFirst.selectedIndex, 1);
  assert.equal(afterFirst.scrollLeft, offsets[1]);
  assert.equal(afterFirst.pendingIndex, 1);
  assert.deepEqual(stepOfferCarousel({ ...state, ...afterFirst }, 1), afterFirst);

  const afterSettle = stepOfferCarousel(
    { ...state, ...afterFirst, pendingIndex: null },
    1,
  );
  assert.equal(afterSettle.selectedIndex, 2);

  const trailing = stepOfferCarousel(
    {
      selectedIndex: 8,
      scrollLeft: maxScrollLeft,
      pendingIndex: null,
      offsets,
      maxScrollLeft,
    },
    1,
  );
  assert.equal(trailing.selectedIndex, 9);
  assert.equal(trailing.scrollLeft, maxScrollLeft);
  assert.equal(trailing.pendingIndex, null);

  assert.deepEqual(
    resyncOfferCarouselFromUserScroll(
      { selectedIndex: 5, pendingIndex: 6, offsets },
      0,
    ),
    { selectedIndex: 5, pendingIndex: 6 },
  );
  assert.deepEqual(
    resyncOfferCarouselFromUserScroll(
      { selectedIndex: 5, pendingIndex: null, offsets },
      maxScrollLeft,
    ),
    { selectedIndex: 8, pendingIndex: null },
  );
});

// Focused tripwire: one-card horizontal wheel/trackpad gestures.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: maintainers changing OfferMenuTrack wheel handling.
// Activation: execute `node --test tests/rendered-html.test.mjs`.
// Behavioral check: one large horizontal delta requests a single adjacent
// step, later events before the idle boundary do not, a later distinct
// gesture can step again, and predominantly vertical input is not captured.
// Retire when the offer carousel is removed or this wheel contract changes.
test("takes only one adjacent card per horizontal wheel gesture", () => {
  assert.equal(offerWheelGestureIdleMs, 180);

  let gesture = { gestureActive: false };
  const first = offerWheelGestureDecision(gesture, {
    deltaX: 8000,
    deltaY: 0,
  });
  assert.deepEqual(first, {
    capture: true,
    step: true,
    direction: 1,
    gestureActive: true,
  });
  gesture = { gestureActive: first.gestureActive };

  const sameGesture = [
    offerWheelGestureDecision(gesture, { deltaX: 8000, deltaY: 0 }),
    offerWheelGestureDecision(gesture, { deltaX: 1200, deltaY: 40 }),
    offerWheelGestureDecision(gesture, { deltaX: 400, deltaY: 0 }),
  ];
  for (const event of sameGesture) {
    assert.equal(event.capture, true);
    assert.equal(event.step, false);
    assert.equal(event.direction, 1);
    assert.equal(event.gestureActive, true);
  }

  const verticalDuringGesture = offerWheelGestureDecision(gesture, {
    deltaX: 0,
    deltaY: 800,
  });
  assert.equal(verticalDuringGesture.capture, false);
  assert.equal(verticalDuringGesture.step, false);
  assert.equal(verticalDuringGesture.direction, 0);

  gesture = { gestureActive: false };
  const nextGesture = offerWheelGestureDecision(gesture, {
    deltaX: 640,
    deltaY: 12,
  });
  assert.deepEqual(nextGesture, {
    capture: true,
    step: true,
    direction: 1,
    gestureActive: true,
  });

  const backward = offerWheelGestureDecision(
    { gestureActive: false },
    { deltaX: -8000, deltaY: 0 },
  );
  assert.deepEqual(backward, {
    capture: true,
    step: true,
    direction: -1,
    gestureActive: true,
  });

  const vertical = offerWheelGestureDecision(
    { gestureActive: false },
    { deltaX: 40, deltaY: 800 },
  );
  assert.deepEqual(vertical, {
    capture: false,
    step: false,
    direction: 0,
    gestureActive: false,
  });

  const pinch = offerWheelGestureDecision(
    { gestureActive: false },
    { deltaX: 8000, deltaY: 0, ctrlKey: true },
  );
  assert.equal(pinch.capture, false);
  assert.equal(pinch.step, false);
});

// Focused desktop-scroll tripwire at tests/rendered-html.test.mjs for the next
// passage editor. Canonical path: tests/rendered-html.test.mjs. Future consumer:
// the next Generations Kitchen passage editor. Activation: execute `npm test`.
// The rendered-page and source consumers require the fixed header to remain outside one fixed smooth wrapper,
// the easing to use the owner-selected 0.41-second exponential time constant,
// all six viewport beats to expose real snap boundaries, mobile to use one
// dynamic-height scrollport instead of the shorter `svh` frame that leaked the
// next scene on expanding browser chrome, and wheel/keyboard travel to change
// only the target of the desktop clock. Retire if the owner selects free
// scrolling or replaces this passage with another single-clock, beat-settled
// implementation.
test("keeps all six beats on the 0.41-second passage clock", async () => {
  const html = await (await render()).text();
  const source = await readFile(
    new URL("../app/desktop-smooth-scroll.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(html, /class="smooth-scroll-wrapper" data-scroll-tau="0\.41"/);
  assert.equal(
    html.match(/data-scroll-beat="[^"]+"/g)?.length,
    6,
    "the opening, three food scenes, offer, and visit scene should each be a snap beat",
  );
  assert.ok(
    html.indexOf('class="site-header"') <
      html.indexOf('class="smooth-scroll-wrapper"'),
    "the fixed header must stay outside transformed scroll content",
  );
  assert.match(source, /DESKTOP_SCROLL_TAU_SECONDS = 0\.41/);
  assert.match(
    source,
    /1 - Math\.exp\(-elapsedSeconds \/ DESKTOP_SCROLL_TAU_SECONDS\)/,
  );
  assert.match(source, /\(min-width: 761px\)/);
  assert.match(source, /get\("smooth"\) === "off"/);
  assert.match(source, /const beatSelector = "\[data-scroll-beat\]"/);
  assert.match(source, /const finalSnapRatio = 0\.01/);
  assert.match(source, /function scrollToBeat\(/);
  assert.match(source, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(source, /addEventListener\("keydown", handleKeydown\)/);
  assert.match(
    css,
    /html\.smooth-scroll-active \.smooth-scroll-wrapper \{[\s\S]*?position:\s*fixed;[\s\S]*?overflow:\s*clip;/,
  );
  assert.match(css, /\[data-scroll-beat\] \{[\s\S]*?scroll-snap-align:\s*start;[\s\S]*?scroll-snap-stop:\s*always;/);
  assert.match(css, /--beat-viewport-height:\s*100vh;/);
  assert.match(css, /@supports \(height:\s*100dvh\)\s*\{[\s\S]*?--beat-viewport-height:\s*100dvh;/);
  assert.match(
    css,
    /@media \(max-width:\s*760px\)\s*\{[\s\S]*?main\s*\{[\s\S]*?height:\s*var\(--beat-viewport-height\);[\s\S]*?overflow-y:\s*auto;[\s\S]*?scroll-snap-type:\s*y mandatory;/,
  );
  assert.doesNotMatch(css, /100svh/);
  assert.match(css, /scroll-snap-type:\s*y mandatory;/);
});

// Focused people-frame edit-boundary tripwire at
// tests/rendered-html.test.mjs for the next menu-media editor. Activation:
// execute `npm test`. The reproducible encoder must begin Loco Moco with the
// blonde reaction and jump over both presenter bridges before the plate and
// eggs; Poke Bowl must begin after its presenter two-shot. Retire only if the
// owner approves new source footage or a different people-in-frame contract.
test("preserves the approved people-free menu edit boundaries", async () => {
  const script = await readFile(
    new URL("../scripts/build-menu-media.ps1", import.meta.url),
    "utf8",
  );

  assert.match(script, /trim=start=7\.5:end=9\.9/);
  assert.match(script, /trim=start=1\.0:end=3\.0/);
  assert.match(script, /trim=start=11\.8:end=13\.8/);
  assert.match(
    script,
    /Encode-Clip -Name "poke-bowl" -Start 184\.2 -Duration 7\.5/,
  );
});

// Focused encode-quality tripwire at tests/rendered-html.test.mjs for the next
// menu-media encoder. Activation: execute `npm test`. Its script consumer
// requires native 1920x968 desktop and 544x968 mobile crops with no baked
// scale-up, browser-safe H.264/yuv420p/faststart, and CRF 21. Retire only if
// a higher-quality source is adopted or the owner accepts a new encode contract.
test("keeps the menu encoder on the source-preserving CRF 21 contract", async () => {
  const script = await readFile(
    new URL("../scripts/build-menu-media.ps1", import.meta.url),
    "utf8",
  );

  assert.match(script, /crop=1920:968:0:0,setsar=1/);
  assert.doesNotMatch(
    script,
    /crop=544:968:688:0/,
    "mobile menu output must keep the same 1920x968 frame as desktop",
  );
  assert.doesNotMatch(
    script,
    /scale=1920:1080/,
    "desktop menu output must stay at the native 1920x968 ticker-free frame",
  );
  assert.doesNotMatch(
    script,
    /scale=1080:1920/,
    "mobile menu output must stay at the native 1920x968 frame",
  );
  assert.match(script, /-c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p/);
  assert.match(script, /-movflags \+faststart/);
  assert.doesNotMatch(
    script,
    /-crf (?:1[0-9]|[0-9])\b/,
    "do not drop below CRF 21 without a higher-quality source",
  );
  assert.doesNotMatch(
    script,
    /\b(?:unsharp|eq=|noise|hue|sharpen)\b/,
    "do not invent detail with filters",
  );
});

test("ships every responsive motion source, poster, place image, and brand mark", async () => {
  const paths = [
    "public/media/max-holloway-opening-desktop.mp4",
    "public/media/max-holloway-opening-mobile.mp4",
    "public/media/max-holloway-opening-poster.jpg",
    "public/media/generations-kitchen-logo.png",
    "public/og.png",
    "public/media/hurricane-chicken-desktop.mp4",
    "public/media/hurricane-chicken-mobile.mp4",
    "public/media/hurricane-chicken-desktop.jpg",
    "public/media/hurricane-chicken-mobile.jpg",
    "public/media/loco-moco-desktop.mp4",
    "public/media/loco-moco-mobile.mp4",
    "public/media/loco-moco-desktop.jpg",
    "public/media/loco-moco-mobile.jpg",
    "public/media/poke-bowl-desktop.mp4",
    "public/media/poke-bowl-mobile.mp4",
    "public/media/poke-bowl-desktop.jpg",
    "public/media/poke-bowl-mobile.jpg",
    "public/media/hurricane-fries-desktop.mp4",
    "public/media/hurricane-fries-mobile.mp4",
    "public/media/hurricane-fries-desktop.jpg",
    "public/media/hurricane-fries-mobile.jpg",
    "public/media/visit-interior-lanterns.jpg",
    "public/media/visit-counter-team.jpg",
    "public/media/visit-interior-counter.jpg",
  ];

  for (const path of paths) {
    const url = new URL(path, projectRoot);
    await access(url);
    const info = await stat(url);
    assert.ok(info.size > 1_000, `${path} should contain a real media asset`);
  }
});

// Focused tripwire at tests/rendered-html.test.mjs for future opening-media
// editors. Activation: execute `npm test`. Desktop and mobile both stay
// 1920x1080 so the first beat can show the highest-fidelity opening on
// phones. Keep the 23.5-24.0s approved entrance. Retire only if the opening
// carrier changes.
test("keeps the opening desktop and mobile at the same 1080-class frame", async () => {
  const expected = [
    ["public/media/max-holloway-opening-desktop.mp4", 1920, 1080],
    ["public/media/max-holloway-opening-mobile.mp4", 1920, 1080],
  ];

  for (const [path, width, height] of expected) {
    const filePath = fileURLToPath(new URL(path, projectRoot));
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      filePath,
    ]);
    const probe = JSON.parse(stdout);

    assert.deepEqual(
      probe.streams?.[0],
      { width, height },
      `${path} should remain ${width}x${height}`,
    );
    assert.ok(
      Number(probe.format?.duration) >= 23.5 &&
        Number(probe.format?.duration) < 24,
      `${path} should keep the complete entrance, Max eating, and the clean closing food beat`,
    );
  }

  const openingScript = await readFile(
    new URL("../scripts/build-opening-media.ps1", import.meta.url),
    "utf8",
  );
  assert.match(openingScript, /trim=start=207\.30:end=218\.733/);
  assert.match(openingScript, /trim=start=110\.80:end=113\.000/);
  assert.match(openingScript, /trim=start=145\.40:end=147\.300/);
  assert.match(openingScript, /trim=start=218\.80:end=220\.534/);
  assert.match(openingScript, /trim=start=240\.20:end=240\.800/);
  assert.match(openingScript, /trim=start=241\.00:end=242\.600/);
  assert.match(openingScript, /trim=start=275\.00:end=276\.833/);
  assert.match(openingScript, /trim=start=284\.40:end=286\.700/);
  assert.match(openingScript, /max-holloway-opening-desktop\.mp4/);
  assert.match(openingScript, /Copy-Item -LiteralPath \$desktop -Destination \$target/);
  assert.doesNotMatch(
    openingScript,
    /crop=506:900:/,
    "mobile opening should ship the full desktop frame, not a portrait crop",
  );
  assert.doesNotMatch(
    openingScript,
    /scale=1080:1920/,
    "do not bake a 1080x1920 upscale into the mobile opening",
  );
});

// Focused menu-media tripwire at tests/rendered-html.test.mjs for the next site
// editor changing featured food footage. Activation: execute `npm test`. Its
// real ffprobe consumer requires desktop 1920x968 and the same 1920x968
// mobile frame, and enough duration to read as a complete food beat. Retire only if
// the menu passage stops using responsive raster video or the owner approves
// a different resolution/duration contract.
test("keeps every menu encode responsive, native-crop, and long enough to read as a beat", async () => {
  const names = [
    ["hurricane-chicken", 9],
    ["loco-moco", 6],
    ["poke-bowl", 7],
  ];

  for (const [name, minimumDuration] of names) {
    for (const [variant, width, height] of [
      ["desktop", 1920, 968],
      ["mobile", 1920, 968],
    ]) {
      const path = `public/media/${name}-${variant}.mp4`;
      const filePath = fileURLToPath(new URL(path, projectRoot));
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:format=duration",
        "-of",
        "json",
        filePath,
      ]);
      const probe = JSON.parse(stdout);

      assert.deepEqual(
        probe.streams?.[0],
        { width, height },
        `${path} should remain ${width}x${height}`,
      );
      assert.ok(
        Number(probe.format?.duration) >= minimumDuration,
        `${path} should preserve its complete visual beat`,
      );
    }
  }
});
