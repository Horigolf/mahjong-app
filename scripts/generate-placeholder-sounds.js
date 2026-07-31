/**
 * 開発用の合成 SE / BGM（WAV）を生成する。
 * 本番向けには DOVA-S 等の素材で同パスを差し替えること（public/assets/AUDIO_CREDITS.md）。
 *
 * Usage: node scripts/generate-placeholder-sounds.js
 */
const fs = require("fs");
const path = require("path");

function writeWav(file, samples, sampleRate = 22050) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

function tone(freq, dur, vol = 0.25, sr = 22050, type = "sine") {
  const n = Math.floor(sr * dur);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env =
      Math.min(1, i / (sr * 0.01)) * Math.min(1, (n - i) / (sr * 0.05));
    let v = Math.sin(2 * Math.PI * freq * t);
    if (type === "click") v = i < sr * 0.008 ? Math.random() * 2 - 1 : 0;
    a[i] = v * vol * env;
  }
  return a;
}

function concat(...arrs) {
  let len = 0;
  for (const a of arrs) len += a.length;
  const o = new Float32Array(len);
  let p = 0;
  for (const a of arrs) {
    o.set(a, p);
    p += a.length;
  }
  return o;
}

const root = path.join(__dirname, "..", "public", "assets");
writeWav(path.join(root, "sounds", "discard.wav"), tone(180, 0.06, 0.35, 22050, "click"));
writeWav(
  path.join(root, "sounds", "pon.wav"),
  concat(tone(220, 0.08, 0.3), tone(330, 0.12, 0.28)),
);
writeWav(
  path.join(root, "sounds", "chi.wav"),
  concat(tone(260, 0.07, 0.28), tone(310, 0.1, 0.25)),
);
writeWav(
  path.join(root, "sounds", "kan.wav"),
  concat(tone(200, 0.08, 0.32), tone(280, 0.08, 0.3), tone(360, 0.14, 0.28)),
);
writeWav(
  path.join(root, "sounds", "riichi.wav"),
  concat(tone(440, 0.12, 0.28), tone(554, 0.12, 0.26), tone(659, 0.2, 0.24)),
);
writeWav(
  path.join(root, "sounds", "tsumo.wav"),
  concat(tone(523, 0.15, 0.28), tone(659, 0.15, 0.26), tone(784, 0.25, 0.24)),
);
writeWav(
  path.join(root, "sounds", "ron.wav"),
  concat(tone(392, 0.12, 0.3), tone(523, 0.12, 0.28), tone(659, 0.22, 0.26)),
);
writeWav(
  path.join(root, "sounds", "ryuukyoku.wav"),
  concat(tone(300, 0.2, 0.22), tone(240, 0.25, 0.2), tone(180, 0.3, 0.18)),
);

const sr = 22050;
const dur = 8;
const n = Math.floor(sr * dur);
const bgm = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const t = i / sr;
  const fade = Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.5);
  const v =
    0.045 * Math.sin(2 * Math.PI * 110 * t) +
    0.03 * Math.sin(2 * Math.PI * 164.81 * t) +
    0.025 * Math.sin(2 * Math.PI * 220 * t) +
    0.02 * Math.sin(2 * Math.PI * 329.63 * t);
  bgm[i] = v * fade * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.15 * t));
}
writeWav(path.join(root, "bgm", "table-ambient.wav"), bgm, sr);
console.log("placeholder sounds written under public/assets/");
