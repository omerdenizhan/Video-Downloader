"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const BIN = path.join(__dirname, "..", "..", "bin");
const ANDROID =
    process.platform === "android" ||
    !!process.env.TERMUX_VERSION ||
    /com\.termux/.test(process.env.PREFIX || "");
const WIN = process.platform === "win32";
const OS = ANDROID ? "linux" : process.platform;
const ANAHTAR = `${OS}-${process.arch}`;
const KLASOR = path.join(BIN, ANAHTAR);
const EXE = WIN ? ".exe" : "";
const MIN_YTDLP = "2025.11.12"; // --js-runtimes destegi bu surumde basladi
const durum = {
    ytDlp: { komut: null, onArgs: [], surum: null, mesaj: "Kontrol edilmedi" },
    ffmpeg: { komut: null, surum: null, mesaj: "Kontrol edilmedi" },
    notlar: { ytDlp: [], ffmpeg: [] },
    sistem: ANAHTAR + (ANDROID ? " (Android/Termux)" : ""),
};
const log = (...a) => console.log("[araclar]", ...a);
function dene(komut, args) {
    try {
        const r = spawnSync(komut, args, {
            timeout: 30000,
            encoding: "utf8",
            windowsHide: true,
        });
        if (r.error || r.status !== 0) return null;
        return String(r.stdout || "").trim();
    } catch {
        return null;
    }
}
function surumKarsilastir(a, b) {
    const pa = String(a)
        .split(".")
        .map((n) => parseInt(n, 10) || 0);
    const pb = String(b)
        .split(".")
        .map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return d;
    }
    return 0;
}
function pythonBul() {
    const yerel = [
        path.join(KLASOR, "python", "python.exe"),
        path.join(BIN, "python", "python.exe"),
        path.join(KLASOR, "python.exe"),
    ];
    for (const y of yerel) {
        if (fs.existsSync(y) && dene(y, ["--version"])) return y;
    }
    for (const p of ["python3", "python", "py"]) if (dene(p, ["--version"])) return p;
    return null;
}
function ytDlpCoz() {
    const adaylar = [];
    if (process.env.YTDLP_YOLU)
        adaylar.push({
            komut: process.env.YTDLP_YOLU,
            onArgs: [],
            kaynak: "YTDLP_YOLU",
        });
    for (const ad of ["yt-dlp" + EXE, "yt-dlp-musl"]) {
        const yol = path.join(KLASOR, ad);
        if (fs.existsSync(yol))
            adaylar.push({
                komut: yol,
                onArgs: [],
                kaynak: path.relative(path.join(BIN, ".."), yol),
            });
    }
    const py = path.join(BIN, "yt-dlp-py");
    const python = fs.existsSync(py) ? pythonBul() : null;
    if (python) {
        adaylar.push({
            komut: python,
            onArgs: [py],
            kaynak: "bin/yt-dlp-py",
        });
    }
    adaylar.push({ komut: "yt-dlp", onArgs: [], kaynak: "sistem PATH" });
    for (const a of adaylar) {
        const s = dene(a.komut, [...a.onArgs, "--version"]);
        if (s) return { ...a, surum: s.split(/\r?\n/)[0] };
    }
    if (fs.existsSync(py) && !python) {
        durum.notlar.ytDlp.push("Python bulunamadi (yt-dlp-py icin gerekli).");
    }
    return null;
}
function ikiliCoz(ad) {
    const adaylar = [];
    if (process.env[ad.toUpperCase() + "_YOLU"])
        adaylar.push(process.env[ad.toUpperCase() + "_YOLU"]);
    const yerel = path.join(KLASOR, ad + EXE);
    if (fs.existsSync(yerel)) adaylar.push(yerel);
    adaylar.push(ad); // sistem PATH
    for (const a of adaylar) {
        const c = dene(a, ["-version"]);
        if (c)
            return {
                komut: a,
                surum: (c.match(/version\s+(\S+)/i) || [])[1] || "-",
            };
    }
    return null;
}
const KURULUM_IPUCU =
    'Cozum: proje klasorunde "npm run araclari-kur" calistirin (Termux: pkg install python ffmpeg).';
function yenile() {
    durum.notlar = { ytDlp: [], ffmpeg: [] };
    const y = ytDlpCoz();
    if (!y) {
        durum.ytDlp = {
            komut: null,
            onArgs: [],
            surum: null,
            mesaj: "yt-dlp bulunamadi veya calistirilamadi.",
        };
        durum.notlar.ytDlp.push(
            `bin/${ANAHTAR} icinde calisan yt-dlp yok. ${KURULUM_IPUCU}`,
        );
    } else if (surumKarsilastir(y.surum, MIN_YTDLP) < 0) {
        durum.ytDlp = {
            ...y,
            mesaj: `Eski surum (${y.surum}); ${MIN_YTDLP}+ gerekir.`,
            eski: true,
        };
        durum.notlar.ytDlp.push(`yt-dlp eski (${y.surum}). ${KURULUM_IPUCU}`);
    } else {
        durum.ytDlp = { ...y, mesaj: "Calismaya hazir." };
    }
    const f = ikiliCoz("ffmpeg");
    durum.ffmpeg = f
        ? { ...f, mesaj: "Calismaya hazir." }
        : {
              komut: null,
              surum: null,
              mesaj: "ffmpeg bulunamadi veya calistirilamadi.",
          };
    if (!f)
        durum.notlar.ffmpeg.push(
            `bin/${ANAHTAR} icinde calisan ffmpeg yok. ${KURULUM_IPUCU}`,
        );
    return durum;
}
function hazirla() {
    yenile();
    log(`Sistem: ${durum.sistem}`);
    log(
        "yt-dlp :",
        durum.ytDlp.komut
            ? `${durum.ytDlp.surum} (${durum.ytDlp.kaynak})`
            : "YOK",
    );
    log("ffmpeg :", durum.ffmpeg.komut ? durum.ffmpeg.surum : "YOK");
    durum.notlar.ytDlp
        .concat(durum.notlar.ffmpeg)
        .forEach((n) => log("UYARI:", n));
}
const ytDlp = () => ({
    komut: durum.ytDlp.komut || "yt-dlp",
    onArgs: durum.ytDlp.onArgs || [],
});
const ffmpegKomutu = () => durum.ffmpeg.komut || "ffmpeg";
const ffmpegKlasoru = () =>
    durum.ffmpeg.komut && path.isAbsolute(durum.ffmpeg.komut)
        ? path.dirname(durum.ffmpeg.komut)
        : null;
module.exports = { hazirla, yenile, durum, ytDlp, ffmpegKomutu, ffmpegKlasoru };
