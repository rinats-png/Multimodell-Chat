# SynthrAI – Motion-Video

Ein 50-Sekunden-Video (1920×1080, 30 fps), komplett aus Code erzeugt. Im Mittelpunkt steht der Vorteil mehrerer KIs gegenüber einer einzelnen.

- `scene.html`: die Animation; `window.render(t)` zeichnet den Zustand zur Zeit `t`, die Bilder sind also reproduzierbar
- `gen-audio.cjs`: Soundeffekte und Musikteppich, rein synthetisch (keine fremden Samples), mit Hall auf dem Effekt-Kanal
- `render.cjs`: rendert Bild für Bild mit Chromium (Playwright) und schreibt per ffmpeg `out/synthrai-promo.mp4`
- `scene-en.html`: englische Fassung mit gleichem Timing (gleiche Tonspur); rendern mit `SCENE=scene-en.html OUT=synthrai-promo-en.mp4 node render.cjs`
- `preview.cjs`: Standbilder zu festen Zeiten (`SCENE=` wählt die Fassung)

```bash
cd video
node gen-audio.cjs
ffmpeg -y -i out/audio.wav -af "loudnorm=I=-15:TP=-1.5:LRA=9" out/audio-norm.wav
node render.cjs
ffmpeg -y -i out/synthrai-promo.mp4 -i out/audio-norm.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest synthrai-promo.mp4
```

Die Schriften (DM Sans, DM Serif Display, SIL Open Font License) stammen aus `@fontsource`.
