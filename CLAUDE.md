# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.

## Project editing conventions

Standing conventions, expected to apply across COMP4020 deliverables:

- Verify requirement-sensitive decisions against the current official course
  source, using the handbook skill or published specification where
  available, rather than relying on memory or an earlier paraphrase.
- Follow the technology requirements of the *current* deliverable rather than
  assuming one stack applies for the whole course --- check the brief before
  assuming plain HTML/CSS, JavaScript, or any other stack is expected.
- Follow the routing and deployment requirements of the current deliverable.
  For static multi-page sites deployed under a GitHub Pages repository
  subpath, use repository-safe relative links such as `./page.html`.
- Prefer small, targeted edits over unrelated redesign --- change what the
  task names, not what's around it.
- Run `pnpm check` after relevant code or layout changes, before calling it
  done.
- Check layout changes at both graded viewports, 1920x1080 and 390x844 ---
  both count in full.
- Explain broad or destructive changes (deleting files, rewriting several
  rules, restructuring pages) and wait for approval before applying them.

## Converting images with `sips` (learned the hard way)

`sips` is the only image tool on this machine (no `sharp`, `magick`, `cwebp`,
or `pngquant`), and it has two failure modes that every sensor in this repo is
blind to. Both shipped a **visually broken page while `pnpm check` stayed
green**, because nothing here renders the page or looks at pixels.

- **Never let `sips` write AVIF.** It produces a file whose container parses
  perfectly --- correct `naturalWidth`/`naturalHeight`, `img.decode()`
  resolves, no error event --- but whose pixels decode to nothing. Drawn to a
  canvas it yields 0 opaque pixels and 1 distinct colour. Worse, a
  `<picture>` with an `<source type="image/avif">` will **not** fall back to
  the `<img src>`, because as far as the browser is concerned the source was
  chosen and decoded successfully. The result is a blank page. `sips --formats`
  also shows `webp` as read-only, so WebP is not an option either: for
  photographs use JPEG, and keep anything with transparency as PNG.
- **Check for an alpha channel before converting any PNG to JPEG.** JPEG has
  no alpha, and `sips` flattens transparency onto **white**, not onto the page
  background --- so a white-on-transparent asset silently becomes an opaque
  white rectangle. Sample a corner pixel first; if it comes back
  `rgba(0,0,0,0)` the file has real transparency and must stay a PNG.
- Line art costs far more in JPEG than photographs do (thousands of edges),
  so expect ~650KB where a photo of the same size lands under 200KB. Trade
  resolution before quality --- artefacts around every line read worse than
  mild softness.

The general lesson, which outlives `sips`: an asset pipeline can only be
verified by rendering the page and sampling actual pixels. Typecheck, build,
lint and the spec suite all passed while the home page was blank.

## Render the page and look at it, every time

The rule above was written about images and turned out to be about everything.
In crit 4 the same blind spot produced a waterfall that read as a stone
obelisk, a row of distant trees that came out as crucifixes across the middle
of the painting, and a stream that read as a paved road — none of which any
check in this repo can see, all of which are obvious in a screenshot.

So: **anything visual gets rendered and looked at before it is called done.**
Headless Chrome is enough —

```sh
pnpm build && pnpm preview --port 4990
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --screenshot=/tmp/shot.png --window-size=1920,1080 \
  "http://localhost:4990/<repo>/"
```

Two traps in that loop, both of which have already wasted time here:

- **Headless clamps its layout viewport at roughly 490px.** Asking for
  `--window-size=390,844` does not give a 390px layout; it gives a ~490px
  layout cropped to 390, so the phone viewport silently lies and reports
  overflow that does not exist. Load the page in a 390px `<iframe>` on a wider
  window when checking the small viewport.
- **Virtual time does not chain `requestAnimationFrame`.** CSS animations
  advance under `--virtual-time-budget`, a rAF loop does not, so a screenshot
  can confirm a keyframe animation but never a JS-driven one. Verify those in a
  real browser, and say so rather than claiming they were checked.

## Sensors have to be able to see the thing they measure

A check that cannot reach its subject is worse than no check, because it
reports on the subject anyway. `spec/instrument.test.ts` globbed `dist/**/*.js`
for evidence of synthesis while Astro was inlining the entry script into the
HTML and emitting no `.js` at all — so it failed while saying the page had no
audio in it, and would have started passing on the unrelated day the bundle
grew past the inlining threshold.

Before trusting a new check, **make it fail for the right reason once**: feed
it something it should reject and read the message it prints. If the message
would not have told you what was actually wrong, the check is not finished.
