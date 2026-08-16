import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

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

  assert.doesNotMatch(html, /teri-beef-fries/);
  assert.doesNotMatch(html, /Teri Beef Fries/);
  assert.doesNotMatch(html, /hurricane-fries/);

  assert.match(html, /6280 S Valley View Blvd/);
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
// requires nativecrop1 on every rebuilt menu video/poster and the rebuilt
// mobile opening, while unchanged opening desktop, poster, and fallback
// stills stay on brandfree3. Retire when a later media rebuild needs a new
// cache key.
test("busts cached enlarged menu and mobile-opening media", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    pageSource,
    /\$\{mediaName\}-desktop\.jpg\?v=nativecrop1/,
  );
  assert.match(
    pageSource,
    /\$\{mediaName\}-mobile\.mp4\?v=nativecrop1/,
  );
  assert.match(
    pageSource,
    /\$\{mediaName\}-desktop\.mp4\?v=nativecrop1/,
  );
  assert.match(
    pageSource,
    /\$\{mediaName\}-mobile\.jpg\?v=nativecrop1/,
  );
  assert.match(
    pageSource,
    /max-holloway-opening-mobile\.mp4\?v=nativecrop1/,
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
    "the rebuilt mobile opening must not keep the pre-native-crop cache key",
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

// Focused motion-default tripwire at tests/rendered-html.test.mjs for the next
// motion-preference editor. Activation: execute `npm test`. Its page, client,
// CSS, and exported-HTML consumers require video-led motion as the public
// default on desktop and mobile, even when the OS reports reduced motion, with
// the static presentation available only through `?motion=reduced`.
// `?motion=full` remains an accepted full-motion URL. Retire only if the owner
// changes the default-vs-explicit-reduced contract.
test("defaults to video-led motion unless the visitor asks for reduced motion", async () => {
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
// production CSS consumers require the fixed ORDER NOW header with a
// decorative green up-right arrow, gold Loco heading, white Poke heading,
// the Hungry Yet / Order Now lockup on Poke Bowl staying gold, the shared
// display face, the pill-shaped header action, and one fixed bottom-center
// order action outside the moving passage, with directional arrows held to
// the same approved deep green. Retire if the owner approves a different
// CTA composition, heading color split, or order language.
test("keeps the visitor calls to action on the display face", async () => {
  const html = await (await render()).text();
  assert.match(html, /<h3>HUNGRY YET\?<\/h3>/);
  assert.match(html, /ORDER NOW/);
  assert.match(
    html,
    /class="order-link"[^>]*>\s*Order Now\s*<span aria-hidden="true">↗<\/span>/,
  );
  assert.match(html, /class="floating-order"/);
  assert.doesNotMatch(html, /Order online/i);
  assert.doesNotMatch(html, /dish-detail|Marinated boneless chicken|Get the plate/);

  const pokeStart = html.indexOf('id="poke-bowl"');
  const offerStart = html.indexOf('id="offer"');
  const dishCta = html.indexOf('class="dish-cta"');
  assert.ok(
    pokeStart >= 0 && dishCta > pokeStart && dishCta < offerStart,
    "the Hungry Yet / Order Now lockup should live on Poke Bowl",
  );

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const blockFor = (selector) => {
    const selectorIndex = css.indexOf(selector);
    assert.ok(selectorIndex >= 0, `${selector} should have a style block`);
    const openBrace = css.indexOf("{", selectorIndex);
    const closeBrace = css.indexOf("}", openBrace);
    return css.slice(openBrace + 1, closeBrace);
  };

  const ctaBlock = blockFor(".dish-cta {");
  const hungryBlock = blockFor(".dish-poke .dish-cta h3 {");
  const orderBlock = blockFor(".dish-cta a,\n.visit-order {");
  const headerOrderBlock = blockFor(".order-link {");
  const locoHeadingBlock = blockFor(".dish-loco h2 {");
  const pokeHeadingBlock = blockFor(".dish-poke h2 {");
  const floatingOrderBlock = blockFor(".floating-order {");
  const headerBlock = blockFor(".site-header {");
  const openingNextBlocks = [...css.matchAll(/\.opening-next\s*\{([^}]*)\}/g)]
    .map((match) => match[1])
    .join("\n");

  assert.doesNotMatch(ctaBlock, /\bbackground(?:-color)?\s*:/);
  assert.match(hungryBlock, /color:\s*var\(--gold\)/);
  assert.match(locoHeadingBlock, /color:\s*var\(--gold\)/);
  assert.match(pokeHeadingBlock, /color:\s*var\(--white\)/);
  assert.doesNotMatch(pokeHeadingBlock, /var\(--gold\)/);
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
  assert.match(
    css,
    /\.floating-order\s*>\s*span\s*\{[^}]*color:\s*var\(--green\)/s,
  );
  assert.match(
    css,
    /\.opening-next\s+span:last-child\s*\{[^}]*color:\s*var\(--green\)/s,
  );
  assert.ok(
    html.indexOf('class="floating-order"') <
      html.indexOf('class="smooth-scroll-wrapper"'),
    "the floating order pill must stay outside transformed passage content",
  );
  assert.match(headerBlock, /position:\s*fixed/);
  assert.match(headerBlock, /z-index:\s*20/);
  assert.match(openingNextBlocks, /font-family:\s*"Arial Black"/);
  assert.doesNotMatch(openingNextBlocks, /\bbackground(?:-color)?\s*:/);
  assert.match(
    css,
    /\.reduced-motion-sequence img \{\s*opacity: 1;\s*animation: none;/,
  );
});

// Focused tripwire: first-order offer climax and dish-carousel contract.
// Canonical path: tests/rendered-html.test.mjs.
// Future consumer: maintainers changing the Generations Kitchen passage/export.
// Activation: execute `node --test tests/rendered-html.test.mjs` after
// `vinext build`.
// Behavioral check: exercises the generated export and rejects return of the
// Teri beat, a slow black hold, transition ray lines, a scaled rectangular
// burst silhouette, offer leak during the black hold, or loss of
// offer/menu links/motion contract. The visitor contract is a 2.8s
// held-breath: ~280ms slam to black, ~700ms empty hold, then a clean
// circular/edgeless flash and soft color bloom, with offer copy appearing
// only after `settled`. The settled field may retain its ambient rays.
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
  ]) {
    assert.match(html, new RegExp(`/media/menu/${file}`));
  }

  for (const href of [
    "furikake-chicken-BLaD",
    "hurricane-chicken-V3Ln",
    "garlic-chicken-9tBv",
    "hamburger-steak-7e8E",
    "loco-moco-mvzn",
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
  const hungry = html.indexOf("HUNGRY YET?");
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
  assert.match(climaxSource, /climaxDurationMs = 2800/);
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] \.offer-shutter \{[\s\S]*?offer-shutter-close 2\.8s linear forwards/,
  );
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] \.offer-flash \{[\s\S]*?offer-flash-white 2\.8s linear forwards/,
  );
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] \.offer-burst \{[\s\S]*?offer-burst-expand 2\.8s linear forwards/,
  );
  assert.doesNotMatch(
    css,
    /offer-shutter-close 1\.65s|offer-flash-line 1\.65s|offer-burst-expand 1\.65s/,
    "the obsolete 1.65s shutoff clock must not remain",
  );
  assert.match(
    css,
    /@keyframes offer-shutter-close \{[\s\S]*?10% \{[\s\S]*?transform:\s*scaleY\(1\);/,
    "shutters must be fully closed by 10% of the 2.8s climax (~280ms)",
  );
  assert.match(
    css,
    /@keyframes offer-shutter-close \{[\s\S]*?35% \{[\s\S]*?transform:\s*scaleY\(1\);[\s\S]*?opacity:\s*1;/,
    "the black hold must release by 35% (~700ms after slam)",
  );
  assert.doesNotMatch(
    css,
    /@keyframes offer-shutter-close \{[\s\S]*?13% \{/,
    "the obsolete 13% close keyframe must not remain",
  );
  assert.match(
    css,
    /@keyframes offer-flash-white \{[\s\S]*?0%,\s*35% \{[\s\S]*?opacity:\s*0;/,
    "the white flash must wait until after the black hold",
  );
  assert.match(
    css,
    /@keyframes offer-flash-white \{[\s\S]*?37% \{[\s\S]*?opacity:\s*0\.97;/,
    "ignition must be a near-white flash",
  );
  assert.match(
    css,
    /@keyframes offer-burst-expand \{[\s\S]*?0%,\s*35% \{[\s\S]*?opacity:\s*0;/,
    "the chromatic burst must stay dark through the black hold",
  );
  const burstRule = css.match(/\.offer-burst \{([^}]+)\}/)?.[1] ?? "";
  const burstExpandStart = css.indexOf("@keyframes offer-burst-expand {");
  const burstCoreStart = css.indexOf("@keyframes offer-burst-core {");
  assert.ok(burstExpandStart >= 0 && burstCoreStart > burstExpandStart);
  const burstExpand = css.slice(burstExpandStart, burstCoreStart);

  assert.match(
    burstRule,
    /clip-path:\s*circle\(/,
    "the burst layer must open through a circular aperture",
  );
  assert.doesNotMatch(
    burstRule,
    /transform:\s*scale\(/,
    "the rest-state burst must not start as a scaled rectangle",
  );
  assert.match(
    burstExpand,
    /clip-path:\s*circle\(/,
    "ignition must grow as a circle, not a scaled box",
  );
  assert.doesNotMatch(
    burstExpand,
    /transform:\s*scale\(/,
    "do not scale the rectangular burst layer; its box becomes a silhouette",
  );
  assert.doesNotMatch(
    css,
    /\.offer-burst::before/,
    "the initial burst must stay a clean bloom with no thin ray layer",
  );
  assert.match(css, /\.offer-flash \{[\s\S]*?background:\s*#fff;/);
  assert.match(css, /\.offer-burst::after \{/);
  assert.match(
    css,
    /\.offer-ray \{\s*background:\s*repeating-conic-gradient\(/,
    "the settled offer field should retain its ambient afterglow rays",
  );
  assert.match(css, /\.offer-field \{[\s\S]*?opacity:\s*0;/);
  assert.match(
    css,
    /html\[data-offer-climax="settled"\] \.offer-field,[\s\S]*?main:not\(\.force-motion\) \.offer-field \{[\s\S]*?opacity:\s*1;/,
  );
  assert.match(
    css,
    /html\[data-offer-climax="playing"\] \.offer-field,[\s\S]*?\.offer-action,[\s\S]*?\.offer-terms,[\s\S]*?\.offer-carousel \{[\s\S]*?opacity:\s*0;/,
    "field, action, terms, and carousel must stay hidden through playing",
  );
  assert.match(css, /\.offer-terms \{[\s\S]*?font-size:\s*1rem;/);
  assert.match(css, /\.offer-track \{[\s\S]*?scrollbar-width:\s*none;/);
  assert.match(css, /\.offer-track::-webkit-scrollbar \{[\s\S]*?display:\s*none;/);
  assert.match(css, /\.offer-track \{[\s\S]*?touch-action:\s*pan-x pan-y;/);
  assert.doesNotMatch(
    css,
    /\.offer-track \{[^}]*overscroll-behavior-y:\s*none/,
    "vertical swipes that start on the carousel must be able to leave the beat",
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
  ]) {
    const url = new URL(file, projectRoot);
    await access(url);
    const info = await stat(url);
    assert.ok(info.size > 1_000, `${file} should be a real menu photograph`);
  }
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
// requires native 1728x972 desktop and 506x900 mobile crops with no baked
// scale-up, browser-safe H.264/yuv420p/faststart, and CRF 21. Retire only if
// a higher-quality source is adopted or the owner accepts a new encode contract.
test("keeps the menu encoder on the source-preserving CRF 21 contract", async () => {
  const script = await readFile(
    new URL("../scripts/build-menu-media.ps1", import.meta.url),
    "utf8",
  );

  assert.match(script, /crop=1728:972:96:0,setsar=1/);
  assert.match(script, /crop=506:900:707:0,setsar=1/);
  assert.doesNotMatch(
    script,
    /scale=1920:1080/,
    "desktop menu output must stay at the native 1728x972 crop",
  );
  assert.doesNotMatch(
    script,
    /scale=1080:1920/,
    "mobile menu output must stay at the native 506x900 crop",
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
// editors. Activation: execute `npm test`. Desktop stays 1920x1080. Mobile
// must be the native 506x900 portrait crop from the UFC 1080p source, not a
// baked 1080x1920 upscale, and must keep the 23.5-24.0s approved entrance.
// Retire only if the opening carrier or source-native crop changes.
test("keeps the opening desktop 1080-class and the mobile opening at native crop", async () => {
  const expected = [
    ["public/media/max-holloway-opening-desktop.mp4", 1920, 1080],
    ["public/media/max-holloway-opening-mobile.mp4", 506, 900],
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
  assert.match(openingScript, /crop=506:900:/);
  assert.doesNotMatch(
    openingScript,
    /scale=1080:1920/,
    "do not bake a 1080x1920 upscale into the mobile opening",
  );
});

// Focused menu-media tripwire at tests/rendered-html.test.mjs for the next site
// editor changing featured food footage. Activation: execute `npm test`. Its
// real ffprobe consumer requires desktop 1728x972 and mobile 506x900 native
// crops, and enough duration to read as a complete food beat. Retire only if
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
      ["desktop", 1728, 972],
      ["mobile", 506, 900],
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
