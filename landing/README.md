# Landing page with feature videos

A static marketing page for the factory-management software, plus the tooling that produces its
videos. No video model is involved: the clips are animated from real screenshots of the running
app, rendered frame by frame in headless Chrome and encoded with ffmpeg.

```
site/                 the landing page: deploy this folder to any static host
  index.html  styles.css  main.js
  media/              feature videos (.mp4) and their poster frames (.jpg)
  img/                screenshots (.webp) for the gallery and phone mock-ups
studio/
  shots/              raw 2× screenshots + manifest.json (positions of buttons and fields)
  scenes.js           the storyboard: camera moves, cursor path, clicks, captions per video
  player.html/js/css  draws any frame of a scene; open it in a browser to preview
scripts/
  capture.mjs         drives the real app with Puppeteer and saves studio/shots
  render.mjs          renders scenes to MP4 + poster
  images.mjs          exports the screenshots the page uses to WebP
  serve.mjs           local preview server
```

## Preview

```bash
npm install
npm run preview          # http://localhost:5050
```

Open `studio/player.html?scene=orders` directly in Chrome to watch and scrub a scene before rendering.

## Change a video

Edit `studio/scenes.js` (timings, captions, zoom, cursor stops), then:

```bash
npm run render -- orders                         # one scene
npm run render -- orders --stills 2,6.5,12       # PNG stills in .frames/ to check framing first
npm run render                                   # everything
```

Box references such as `'billing-1.record'` point to entries in `studio/shots/manifest.json`, so the
cursor and highlights land on the right element even after re-capturing.

## Re-capture the screenshots (after UI changes)

The flows create data (an order, a payment, a check-in...), so start from a freshly seeded demo API:

```bash
# in ../backend:  in-memory MongoDB with demo data; file links must use the portal URL
APP_URL=http://localhost:3123/portal npx tsx src/dev-memory.ts
# in ../frontend:
npx next build && npx next start -p 3123
# here (MONGO_URI is optional; it seeds two weeks of attendance so the calendar is full):
APP_URL=http://localhost:3123/portal MONGO_URI=mongodb://127.0.0.1:<mongod port>/ss_textiles npm run capture
npm run build            # render videos + export images
```

`npm run capture -- billing,roles` re-runs single flows. Chrome is found automatically; set
`CHROME_PATH` if it is installed somewhere unusual.

## Things to replace before publishing

- **Product name**: "Loomline" is a placeholder (page title, header, footer, `BRAND` in `studio/scenes.js`).
- **Contact address**: `data-email="sales@example.com"` on the demo form in `site/index.html`.
  The form opens the visitor's mail app; swap it for your form backend if you have one.
- The screenshots show the demo workspace "SNS Textiles" and seeded customer names.
