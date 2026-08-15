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
// exported HTML consumer requires the approved opening, four food beats,
// current menu/directions/Instagram destinations, and the removed broadcast
// name and retired order host to stay absent. Retire only if the owner approves
// a different journey or destination contract.
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
  assert.equal(foodPassages.length, 4, "the journey should contain four food beats");

  for (const id of ["hurricane", "loco-moco", "poke-bowl", "teri-beef-fries"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  for (const mediaName of [
    "hurricane-chicken",
    "loco-moco",
    "poke-bowl",
    "hurricane-fries",
  ]) {
    assert.match(html, new RegExp(`${mediaName}-desktop\\.mp4`));
    assert.match(html, new RegExp(`${mediaName}-mobile\\.mp4`));
  }

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

// Focused GitHub Pages export tripwire at tests/rendered-html.test.mjs for the
// next deployment editor. Activation: execute `npm test`. The static-hosting
// consumer requires output: "export", a complete dist/client/index.html, and a
// Pages workflow that publishes that exact directory. Retire if the owner moves
// the canonical site away from static GitHub Pages hosting.
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
  assert.match(scrollSource, /get\("motion"\)\s*===\s*"full"/);
  assert.match(scrollSource, /classList\.add\("force-motion"\)/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path:\s*dist\/client/);
  assert.equal(customDomain.trim(), "generations.jarrettwroten.com");
  await access(new URL("../public/.nojekyll", import.meta.url));
});

// Focused CTA-surface tripwire at tests/rendered-html.test.mjs for future page
// editors. Activation: execute `npm test`. Its server-rendered HTML and
// production CSS consumers require the fixed ORDER NOW header, the Hungry /
// Order Now lockup on Teri Beef Fries only, its single-line title, the shared
// display face, the pill-shaped header action, and one fixed bottom-center order
// action outside the moving passage, with both directional arrows held to the
// same approved deep green.
// Retire if the owner approves a different CTA composition or order language.
test("keeps the visitor calls to action on the display face", async () => {
  const html = await (await render()).text();
  assert.match(html, /<h3>Hungry\?<\/h3>/);
  assert.match(html, /Order Now/);
  assert.match(html, /class="floating-order"/);
  assert.doesNotMatch(html, /Order online/i);
  assert.doesNotMatch(html, /dish-detail|Marinated boneless chicken|Get the plate/);

  const teriStart = html.indexOf('id="teri-beef-fries"');
  const visitStart = html.indexOf('id="visit"');
  const dishCta = html.indexOf('class="dish-cta"');
  assert.ok(
    teriStart >= 0 && dishCta > teriStart && dishCta < visitStart,
    "the Hungry / Order Now lockup should live on Teri Beef Fries",
  );
  assert.match(
    html,
    /<h2 id="teri-beef-fries-title">Teri Beef Fries\.<\/h2>/,
    "the Teri Beef Fries title should stay on one line",
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
  const hungryBlock = blockFor(".dish-cta h3 {");
  const orderBlock = blockFor(".dish-cta a,\n.visit-order {");
  const headerOrderBlock = blockFor(".order-link {");
  const floatingOrderBlock = blockFor(".floating-order {");
  const headerBlock = blockFor(".site-header {");
  const openingNextBlocks = [...css.matchAll(/\.opening-next\s*\{([^}]*)\}/g)]
    .map((match) => match[1])
    .join("\n");

  assert.doesNotMatch(ctaBlock, /\bbackground(?:-color)?\s*:/);
  assert.match(hungryBlock, /font-family:\s*"Arial Black"/);
  assert.match(orderBlock, /font-family:\s*"Arial Black"/);
  assert.match(orderBlock, /color:\s*var\(--gold\)/);
  assert.match(orderBlock, /white-space:\s*nowrap/);
  assert.match(headerOrderBlock, /font-family:\s*"Arial Black"/);
  assert.match(headerOrderBlock, /background:\s*var\(--gold\)/);
  assert.match(headerOrderBlock, /border-radius:\s*999px/);
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

// Focused desktop-scroll tripwire at tests/rendered-html.test.mjs for the next
// passage editor. Activation: execute `npm test`. The rendered-page and source
// consumers require the fixed header to remain outside one fixed smooth wrapper,
// the easing to use the owner-selected 0.41-second exponential time constant,
// all six viewport beats to expose real snap boundaries, and wheel/keyboard
// travel to change only the target of that one clock. Retire if the owner selects
// free desktop scrolling or replaces this passage with another single-clock,
// beat-settled implementation.
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
    "the opening, four food scenes, and visit scene should each be a snap beat",
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
  assert.match(css, /height:\s*100svh;/);
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
// editors. Activation: execute `npm test`. Its real ffprobe consumer checks both
// shipped files and prevents a quiet return to the earlier upscaled 360p source
// or a shortened entrance / branded end transition. Retire only if the opening
// carrier stops using
// responsive raster video or its approved resolution/duration contract changes.
test("keeps both opening encodes 1080-class and preserves the full entrance", async () => {
  const expected = [
    ["public/media/max-holloway-opening-desktop.mp4", 1920, 1080],
    ["public/media/max-holloway-opening-mobile.mp4", 1080, 1920],
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
});

// Focused menu-media tripwire at tests/rendered-html.test.mjs for the next site
// editor changing featured food footage. Activation: execute `npm test`. Its
// real ffprobe consumer requires every desktop/mobile pair to retain the
// intended geometry and enough duration to read as a complete food beat.
// Retire only if the menu passage stops using responsive raster video or the
// owner approves a different resolution/duration contract.
test("keeps every menu encode responsive, 1080-class, and long enough to read as a beat", async () => {
  const names = [
    ["hurricane-chicken", 9],
    ["loco-moco", 6],
    ["poke-bowl", 7],
    ["hurricane-fries", 4],
  ];

  for (const [name, minimumDuration] of names) {
    for (const [variant, width, height] of [
      ["desktop", 1920, 1080],
      ["mobile", 1080, 1920],
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
