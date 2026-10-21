"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const https = require("https");
const { execFile, spawnSync } = require("child_process");
const BIN = path.join(__dirname, "..", "bin");
const ANDROID =
    process.platform === "android" ||
    !!process.env.TERMUX_VERSION ||
    /com\.termux/.test(process.env.PREFIX || "");
const HOST_OS = ANDROID ? "linux" : process.platform;
const HOST_KEY = `${HOST_OS}-${process.arch}`;
const TUMU = process.env.ARAC_TUMU !== "0";
const YENILE = process.env.ARAC_YENILE === "1";
const YTDLP_YENILIK_MS = 7 * 24 * 3600 * 1000;
const FFMPEG_SURUM = "b6.1.1";
const YTDLP = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";
const FFMPEG = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_SURUM}/ffmpeg-`;
const FFPROBE = (surum, ad) =>
    `https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/${surum}/ffprobe-${surum.slice(1)}-${ad}.zip`;
const HEDEFLER = {
    "win32-x64": {
        yt: [["yt-dlp.exe", YTDLP + "yt-dlp.exe"]],
        ff: "win32-x64",
        fp: FFPROBE("v6.1", "win-64"),
    },
    "win32-arm64": {
        yt: [["yt-dlp.exe", YTDLP + "yt-dlp_arm64.exe"]],
        ff: "win32-x64",
        fp: FFPROBE("v6.1", "win-64"),
    },
    "win32-ia32": {
        yt: [["yt-dlp.exe", YTDLP + "yt-dlp_x86.exe"]],
        ff: null,
        fp: null,
    },
    "linux-x64": {
        yt: [
            ["yt-dlp", YTDLP + "yt-dlp_linux"],
            ["yt-dlp-musl", YTDLP + "yt-dlp_musllinux"],
        ],
        ff: "linux-x64",
        fp: FFPROBE("v6.1", "linux-64"),
    },
    "linux-arm64": {
        yt: [
            ["yt-dlp", YTDLP + "yt-dlp_linux_aarch64"],
            ["yt-dlp-musl", YTDLP + "yt-dlp_musllinux_aarch64"],
        ],
        ff: "linux-arm64",
        fp: FFPROBE("v6.1", "linux-arm-64"),
    },
    "linux-arm": {
        yt: [["yt-dlp", YTDLP + "yt-dlp_linux_armv7l.zip"]],
        ff: "linux-arm",
        fp: FFPROBE("v6.1", "linux-armhf-32"),
    },
    "linux-ia32": { yt: [], ff: "linux-ia32", fp: FFPROBE("v6.1", "linux-32") },
    "darwin-x64": {
        yt: [["yt-dlp", YTDLP + "yt-dlp_macos"]],
        ff: "darwin-x64",
        fp: FFPROBE("v4.4.1", "osx-64"),
    },
    "darwin-arm64": {
        yt: [["yt-dlp", YTDLP + "yt-dlp_macos"]],
        ff: "darwin-arm64",
        fp: FFPROBE("v4.4.1", "osx-64"),
    },
};
const log = (...a) => console.log("[araclar]", ...a);
const exe = (anahtar) => (anahtar.startsWith("win32") ? ".exe" : "");
function httpsIndir(url, hedef, yonlendirme = 0) {
    return new Promise((resolve, reject) => {
        if (yonlendirme > 8) return reject(new Error("Cok fazla yonlendirme"));
        const istek = https.get(
            url,
            { headers: { "User-Agent": "video-indirici-kurulum" } },
            (res) => {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location
                ) {
                    res.resume();
                    return resolve(
                        httpsIndir(
                            new URL(res.headers.location, url).toString(),
                            hedef,
                            yonlendirme + 1,
                        ),
                    );
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error("HTTP " + res.statusCode));
                }
                const dosya = fs.createWriteStream(hedef);
                res.pipe(dosya);
                dosya.on("finish", () => dosya.close(resolve));
                dosya.on("error", reject);
                res.on("error", reject);
            },
        );
        istek.setTimeout(60000, () => istek.destroy(new Error("Zaman asimi")));
        istek.on("error", reject);
    });
}
function indir(url, hedef) {
    return httpsIndir(url, hedef).catch(
        () =>
            new Promise((resolve, reject) => {
                // Dogrudan baglanti (proxy vb.) basarisizsa curl ile dene
                execFile(
                    "curl",
                    ["-fsSL", "--retry", "2", "-o", hedef, url],
                    { timeout: 900000 },
                    (h) => (h ? reject(h) : resolve()),
                );
            }),
    );
}
function gzAc(kaynak, hedef) {
    fs.writeFileSync(hedef, zlib.gunzipSync(fs.readFileSync(kaynak)));
}
function zipIlkDosya(kaynak, hedef) {
    const b = fs.readFileSync(kaynak);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--)
        if (b.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    if (eocd < 0) throw new Error("Gecersiz zip");
    let p = b.readUInt32LE(eocd + 16);
    const adet = b.readUInt16LE(eocd + 10);
    for (let n = 0; n < adet; n++) {
        if (b.readUInt32LE(p) !== 0x02014b50) break;
        const yontem = b.readUInt16LE(p + 10);
        const sikisik = b.readUInt32LE(p + 20);
        const adUzunluk = b.readUInt16LE(p + 28),
            ekUzunluk = b.readUInt16LE(p + 30),
            yorumUzunluk = b.readUInt16LE(p + 32);
        const yerel = b.readUInt32LE(p + 42);
        const ad = b.toString("utf8", p + 46, p + 46 + adUzunluk);
        p += 46 + adUzunluk + ekUzunluk + yorumUzunluk;
        if (ad.endsWith("/")) continue;
        const dataBas =
            yerel +
            30 +
            b.readUInt16LE(yerel + 26) +
            b.readUInt16LE(yerel + 28);
        const veri = b.subarray(dataBas, dataBas + sikisik);
        fs.writeFileSync(
            hedef,
            yontem === 0 ? veri : zlib.inflateRawSync(veri),
        );
        return;
    }
    throw new Error("Zip icinde dosya yok");
}
function isListesi() {
    const anahtarlar = TUMU
        ? Object.keys(HEDEFLER)
        : HEDEFLER[HOST_KEY]
          ? [HOST_KEY]
          : [];
    const isler = new Map(); // url -> { url, hedefler: [], ytdlp }
    const ekle = (url, hedef, ytdlp) => {
        if (!isler.has(url)) isler.set(url, { url, hedefler: [], ytdlp });
        isler.get(url).hedefler.push(hedef);
    };
    for (const k of anahtarlar) {
        const h = HEDEFLER[k];
        if (ANDROID && !TUMU && k !== HOST_KEY) continue;
        for (const [ad, url] of h.yt) ekle(url, path.join(BIN, k, ad), true);
        if (h.ff)
            ekle(
                FFMPEG + h.ff + ".gz",
                path.join(BIN, k, "ffmpeg" + exe(k)),
                false,
            );
        if (h.fp) ekle(h.fp, path.join(BIN, k, "ffprobe" + exe(k)), false);
    }
    ekle(YTDLP + "yt-dlp", path.join(BIN, "yt-dlp-py"), true);
    return [...isler.values()];
}
function guncelMi(is) {
    if (YENILE) return false;
    return is.hedefler.every((h) => {
        try {
            const st = fs.statSync(h);
            if (st.size === 0) return false;
            return is.ytdlp ? Date.now() - st.mtimeMs < YTDLP_YENILIK_MS : true;
        } catch {
            return false;
        }
    });
}
async function isiYap(is) {
    if (guncelMi(is)) return { is, durum: "var" };
    const gecici = path.join(
        os.tmpdir(),
        "arac-" + process.pid + "-" + Math.random().toString(36).slice(2),
    );
    try {
        await indir(is.url, gecici);
        const ilk = is.hedefler[0];
        fs.mkdirSync(path.dirname(ilk), { recursive: true });
        const gecici2 = ilk + ".yeni";
        if (is.url.endsWith(".gz")) gzAc(gecici, gecici2);
        else if (is.url.endsWith(".zip")) zipIlkDosya(gecici, gecici2);
        else fs.copyFileSync(gecici, gecici2);
        fs.chmodSync(gecici2, 0o755);
        fs.renameSync(gecici2, ilk);
        for (const h of is.hedefler.slice(1)) {
            fs.mkdirSync(path.dirname(h), { recursive: true });
            fs.copyFileSync(ilk, h);
            fs.chmodSync(h, 0o755);
        }
        return { is, durum: "indirildi" };
    } catch (e) {
        return { is, durum: "hata", hata: e.message };
    } finally {
        try {
            fs.unlinkSync(gecici);
        } catch {}
    }
}
async function paralel(liste, adet, fn) {
    const sonuc = [];
    let i = 0;
    await Promise.all(
        Array.from({ length: adet }, async () => {
            while (i < liste.length) {
                const bu = i++;
                sonuc[bu] = await fn(liste[bu]);
                const s = sonuc[bu];
                log(
                    `${s.durum === "hata" ? "HATA " : s.durum === "var" ? "mevcut" : "indirildi"}: ${path.relative(path.join(BIN, ".."), s.is.hedefler[0])}${s.hata ? " - " + s.hata : ""}`,
                );
            }
        }),
    );
    return sonuc;
}
function dene(komut, args) {
    try {
        const r = spawnSync(komut, args, {
            timeout: 30000,
            encoding: "utf8",
            windowsHide: true,
        });
        return !r.error && r.status === 0
            ? String(r.stdout || "")
                  .trim()
                  .split(/\r?\n/)[0]
            : null;
    } catch {
        return null;
    }
}
function pythonBul() {
    const yerel = [
        path.join(BIN, HOST_KEY, "python", "python.exe"),
        path.join(BIN, "python", "python.exe"),
        path.join(BIN, HOST_KEY, "python.exe"),
    ];
    for (const y of yerel) {
        if (fs.existsSync(y) && dene(y, ["--version"])) return y;
    }
    for (const p of ["python3", "python", "py"])
        if (dene(p, ["--version"])) return p;
    return null;
}
async function pythonKur() {
    if (pythonBul()) return;
    if (ANDROID) {
        log("Python kuruluyor (pkg install python)...");
        await sh("pkg install -y python");
        return;
    }
    if (process.platform === "win32") {
        log("Python bulunamadi, Windows icin tasinabilir Python kuruluyor...");
        const arch = process.arch;
        const dosyaAdi =
            arch === "ia32"
                ? "python-3.11.9-embed-win32.zip"
                : arch === "arm64"
                  ? "python-3.11.9-embed-arm64.zip"
                  : "python-3.11.9-embed-amd64.zip";
        const url = `https://www.python.org/ftp/python/3.11.9/${dosyaAdi}`;
        const hedefKlasor = path.join(BIN, HOST_KEY, "python");
        const geciciZip = path.join(os.tmpdir(), `python-${Date.now()}.zip`);
        try {
            await indir(url, geciciZip);
            fs.mkdirSync(hedefKlasor, { recursive: true });
            const tarSonuc = spawnSync(
                "tar",
                ["-xf", geciciZip, "-C", hedefKlasor],
                { windowsHide: true },
            );
            if (tarSonuc.error || tarSonuc.status !== 0) {
                spawnSync(
                    "powershell",
                    [
                        "-NoProfile",
                        "-Command",
                        `Expand-Archive -Path '${geciciZip}' -DestinationPath '${hedefKlasor}' -Force`,
                    ],
                    { windowsHide: true },
                );
            }
            const pthDosyasi = path.join(hedefKlasor, "python311._pth");
            if (fs.existsSync(pthDosyasi)) {
                let icerik = fs.readFileSync(pthDosyasi, "utf8");
                icerik = icerik.replace("#import site", "import site");
                fs.writeFileSync(pthDosyasi, icerik);
            }
            log(`Python basariyla kuruldu: ${hedefKlasor}\\python.exe`);
        } catch (hata) {
            log("Python indirme/kurulum hatasi:", hata.message);
        } finally {
            try {
                fs.unlinkSync(geciciZip);
            } catch {}
        }
    }
}
function dogrula() {
    const klasor = path.join(BIN, HOST_KEY);
    const sonuc = { yt: false, ff: false };
    const ytAdaylar = [
        [path.join(klasor, "yt-dlp" + exe(HOST_KEY)), []],
        [path.join(klasor, "yt-dlp-musl"), []],
    ];
    const py = pythonBul();
    if (py) ytAdaylar.push([py, [path.join(BIN, "yt-dlp-py")]]);
    ytAdaylar.push(["yt-dlp", []]);
    for (const [k, a] of ytAdaylar) {
        const s = dene(k, [...a, "--version"]);
        if (s) {
            sonuc.yt = s;
            break;
        }
    }
    for (const k of [path.join(klasor, "ffmpeg" + exe(HOST_KEY)), "ffmpeg"]) {
        const s = dene(k, ["-version"]);
        if (s) {
            sonuc.ff = s;
            break;
        }
    }
    return sonuc;
}
function sh(komut) {
    return new Promise((resolve) =>
        execFile("sh", ["-c", komut], { timeout: 900000 }, (h) => resolve(!h)),
    );
}
async function main() {
    log(
        `Sistem: ${process.platform}/${process.arch}${ANDROID ? " (Android/Termux)" : ""} | Kapsam: ${TUMU ? "tum sistemler" : "sadece bu sistem"}`,
    );
    fs.mkdirSync(BIN, { recursive: true });
    const isler = isListesi();
    const sonuclar = await paralel(isler, 3, isiYap);
    const hatalar = sonuclar.filter((s) => s.durum === "hata");
    await pythonKur();
    if (ANDROID) {
        let d = dogrula();
        if (!d.ff) {
            log("Indirilen ffmpeg calismadi, pkg ile kuruluyor...");
            await sh("pkg install -y ffmpeg");
        }
    }
    const d = dogrula();
    log("Bu sistemde yt-dlp:", d.yt || "CALISMIYOR");
    log("Bu sistemde ffmpeg:", d.ff || "CALISMIYOR");
    if (hatalar.length)
        log(
            `${hatalar.length} dosya indirilemedi. Internet baglantisini kontrol edip tekrar: npm run araclari-kur`,
        );
    if (!d.yt || !d.ff)
        log(
            "UYARI: Bu sistemde arac eksik. Cozum: npm run araclari-kur  (Termux: pkg install python ffmpeg)",
        );
}
main()
    .catch((e) => log("Kurulum hatasi:", e.message))
    .finally(() => process.exit(0));
