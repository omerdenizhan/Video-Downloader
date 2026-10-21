"use strict";

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");
const { platformTespit } = require("./platform");
const ayarlar = require("./ayarlar");
const araclar = require("./araclar");
const GECICI_KLASOR = path.join(__dirname, "..", "..", "gecici");
const aktifIndirmeler = new Map();
function aktifIndirmeEkle(kayit) {
    if (!kayit?.id) return;
    aktifIndirmeler.set(kayit.id, {
        ...kayit,
        durum: "isleniyor",
        baslangic: Date.now(),
    });
}
function aktifIndirmeGuncelle(id, degisiklik) {
    if (!id || !aktifIndirmeler.has(id)) return;
    aktifIndirmeler.set(id, { ...aktifIndirmeler.get(id), ...degisiklik });
}
function aktifIndirmeKaldir(id) {
    if (id) aktifIndirmeler.delete(id);
}
let jsSecenekleriDestekli = true;
function ytDlpJavascriptArgumanlari() {
    if (!jsSecenekleriDestekli) return [];
    const nodeYolu = process.execPath;
    const runtime =
        nodeYolu && fs.existsSync(nodeYolu) ? `node:${nodeYolu}` : "node";
    const remoteComponents =
        process.env.YTDLP_REMOTE_COMPONENTS === "0"
            ? ""
            : process.env.YTDLP_REMOTE_COMPONENTS || "ejs:github";
    const args = ["--js-runtimes", runtime];
    if (remoteComponents) args.push("--remote-components", remoteComponents);
    return args;
}
function secenekHatasiMi(metin) {
    return /no such option|unrecognized arguments|unknown option|invalid.*(js-runtimes|remote-components)/i.test(
        String(metin || ""),
    );
}
function hataKaydet(mesaj) {
    console.error("[yt-dlp]", mesaj);
    try {
        require("../../veritabani/veritabani").calistir(
            "INSERT INTO hatalar (mesaj, yol) VALUES (?, ?)",
            [String(mesaj).slice(0, 500), "yt-dlp"],
        );
    } catch {}
}
function ytDlpCalistir(argsFn, secenekler, cb) {
    const calistir = () => {
        const { komut, onArgs } = araclar.ytDlp();
        try {
            execFile(
                komut,
                [...onArgs, ...argsFn(ytDlpJavascriptArgumanlari())],
                { windowsHide: true, ...secenekler },
                (hata, stdout, stderr) => {
                    if (
                        hata &&
                        jsSecenekleriDestekli &&
                        secenekHatasiMi(stderr)
                    ) {
                        jsSecenekleriDestekli = false;
                        hataKaydet(
                            "yt-dlp surumu eski (--js-runtimes desteklemiyor); seceneksiz tekrar deneniyor. npm run araclari-kur ile guncelleyin.",
                        );
                        return calistir();
                    }
                    if (hata) {
                        const detay = String(stderr || hata.message || "")
                            .trim()
                            .split(/\r?\n/)
                            .filter(Boolean)
                            .slice(-3)
                            .join(" | ");
                        hataKaydet(`yt-dlp hata (kod ${hata.code}): ${detay}`);
                    }
                    cb(hata, stdout, stderr);
                },
            );
        } catch (e) {
            hataKaydet("yt-dlp baslatilamadi: " + e.message);
            cb(e, "", String(e.message));
        }
    };
    calistir();
}
function dosyaAdiHazirla(baslik) {
    const temiz = String(baslik || "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/, "")
        .slice(0, 150);
    return temiz || "dosya";
}
function oynatmaListesiUrlMi(url) {
    try {
        const parsed = new URL(url);
        const youtube = parsed.hostname.toLowerCase().endsWith("youtube.com");
        const liste = parsed.searchParams.has("list");
        return youtube && liste;
    } catch {
        return false;
    }
}
function medyaBilgisiAl(url, cb) {
    const bilgi = platformTespit(url);
    if (!bilgi) return cb(new Error("Desteklenmeyen platform"));
    if (oynatmaListesiUrlMi(url))
        return oynatmaListesiBilgisiAl(url, bilgi, cb);
    ytDlpCalistir(
        (js) => [...js, "--no-warnings", "--dump-json", "--no-playlist", url],
        { timeout: 60000, maxBuffer: 20 * 1024 * 1024 },
        (hata, stdout) => {
            if (hata) return cb(new Error("Medya bilgisi alinamadi"));
            try {
                const veri = JSON.parse(String(stdout).trim().split("\n")[0]);
                const tumFormatlar = veri.formats || [];
                const formatHaritasi = new Map();
                const sesVarmi = tumFormatlar.some(
                    (f) => f.acodec && f.acodec !== "none",
                );
                const birlesikMp4Var = tumFormatlar.some((f) => {
                    const uzanti = String(f.ext || "").toLowerCase();
                    const videoVar = f.vcodec && f.vcodec !== "none";
                    const sesVar = f.acodec && f.acodec !== "none";
                    return uzanti === "mp4" && videoVar && sesVar;
                });
                const platformYoutube =
                    bilgi.platform === "youtube" ||
                    bilgi.platform === "youtube_shorts";
                tumFormatlar.forEach((f) => {
                    const videoVar = f.vcodec && f.vcodec !== "none";
                    const sesVar = f.acodec && f.acodec !== "none";
                    const yukseklik = Number(f.height || 0);
                    const uzanti = String(f.ext || "").toLowerCase();
                    const codec = String(f.vcodec || "").toLowerCase();
                    const protokol = String(f.protocol || "").toLowerCase();
                    const etiket = yukseklik + "p";
                    if (!videoVar || !yukseklik || uzanti !== "mp4") return;
                    if (platformYoutube) {
                        const codecPuan =
                            codec.includes("avc1") || codec.includes("h264")
                                ? 4
                                : codec.includes("av01")
                                  ? 3
                                  : codec.includes("vp9")
                                    ? 2
                                    : 1;
                        const protokolPuan = protokol.includes("m3u8")
                            ? 3
                            : protokol.includes("https")
                              ? 2
                              : 1;
                        const mevcut = formatHaritasi.get(etiket);
                        if (
                            !mevcut ||
                            protokolPuan > mevcut.protokolPuan ||
                            (protokolPuan === mevcut.protokolPuan &&
                                (codecPuan > mevcut.codecPuan ||
                                    (codecPuan === mevcut.codecPuan &&
                                        Number(f.tbr || 0) >
                                            Number(mevcut.tbr || 0))))
                        ) {
                            formatHaritasi.set(etiket, {
                                tur: "video",
                                format: "mp4",
                                kalite: etiket,
                                yukseklik,
                                tbr: Number(f.tbr || 0),
                                codecPuan,
                                protokolPuan,
                                sesVar,
                            });
                        }
                        return;
                    }
                    if (birlesikMp4Var) {
                        if (!sesVar) return;
                        if (!codec.includes("avc1") && !codec.includes("h264"))
                            return;
                        const mevcut = formatHaritasi.get(etiket);
                        if (
                            !mevcut ||
                            Number(f.tbr || 0) > Number(mevcut.tbr || 0)
                        ) {
                            formatHaritasi.set(etiket, {
                                tur: "video",
                                format: "mp4",
                                kalite: etiket,
                                yukseklik,
                                tbr: Number(f.tbr || 0),
                            });
                        }
                        return;
                    }
                    const codecPuan =
                        codec.includes("avc1") || codec.includes("h264")
                            ? 2
                            : codec.includes("hev1") || codec.includes("hvc1")
                              ? 0
                              : 1;
                    const mevcut = formatHaritasi.get(etiket);
                    if (
                        !mevcut ||
                        codecPuan > mevcut.codecPuan ||
                        (codecPuan === mevcut.codecPuan &&
                            Number(f.tbr || 0) > Number(mevcut.tbr || 0))
                    ) {
                        formatHaritasi.set(etiket, {
                            tur: "video",
                            format: "mp4",
                            kalite: etiket,
                            yukseklik,
                            tbr: Number(f.tbr || 0),
                            codecPuan,
                        });
                    }
                });
                const formatlar = [...formatHaritasi.values()]
                    .sort((a, b) => b.yukseklik - a.yukseklik)
                    .map(
                        ({ codecPuan, protokolPuan, sesVar, ...kalan }) =>
                            kalan,
                    );
                if (sesVarmi)
                    formatlar.push({
                        tur: "ses",
                        format: "mp3",
                        kalite: "En Iyi",
                        yukseklik: 0,
                    });
                cb(null, {
                    baslik: (veri.title || "Video").slice(0, 100),
                    sure: veri.duration || 0,
                    kucukResim: veri.thumbnail || "",
                    platform: bilgi,
                    formatlar,
                });
            } catch {
                cb(new Error("Medya ayristirilamadi"));
            }
        },
    );
}
function oynatmaListesiBilgisiAl(url, bilgi, cb) {
    ytDlpCalistir(
        (js) => [
            ...js,
            "--dump-single-json",
            "--flat-playlist",
            "--playlist-end",
            "50",
            "--no-warnings",
            "--skip-download",
            url,
        ],
        { timeout: 60000, maxBuffer: 20 * 1024 * 1024 },
        (hata, stdout) => {
            if (hata) return cb(new Error("Oynatma listesi bilgisi alinamadi"));
            try {
                const veri = JSON.parse(String(stdout || "").trim());
                const oynatmaListesi = (veri.entries || [])
                    .filter((kayit) => kayit && kayit.id)
                    .map((kayit) => ({
                        id: String(kayit.id),
                        url:
                            kayit.webpage_url ||
                            `https://www.youtube.com/watch?v=${encodeURIComponent(kayit.id)}`,
                        baslik: String(kayit.title || "Basliksiz video").slice(
                            0,
                            200,
                        ),
                        kanal: String(
                            kayit.channel || kayit.uploader || "",
                        ).slice(0, 100),
                        sure: Number(kayit.duration || 0),
                        kucukResim:
                            kayit.thumbnail ||
                            `https://i.ytimg.com/vi/${encodeURIComponent(kayit.id)}/hqdefault.jpg`,
                        yayinTarihi: String(kayit.upload_date || ""),
                    }));
                cb(null, {
                    tur: "oynatma_listesi",
                    baslik: String(
                        veri.title || "YouTube oynatma listesi",
                    ).slice(0, 200),
                    kucukResim: oynatmaListesi[0]?.kucukResim || "",
                    platform: bilgi,
                    oynatmaListesi,
                    toplam: oynatmaListesi.length,
                    maksTopluVideo: ayarlar.tumunuAl().maksTopluVideo,
                });
            } catch {
                cb(new Error("Oynatma listesi ayristirilamadi"));
            }
        },
    );
}
function youtubeAra(sorgu, cb) {
    const temizSorgu = String(sorgu || "").trim();
    if (!temizSorgu) return cb(new Error("Arama ifadesi bos"));
    ytDlpCalistir(
        (js) => [
            ...js,
            "--dump-json",
            "--flat-playlist",
            "--no-warnings",
            "--skip-download",
            `ytsearch10:${temizSorgu}`,
        ],
        { timeout: 60000, maxBuffer: 20 * 1024 * 1024 },
        (hata, stdout) => {
            if (hata) return cb(new Error("YouTube aramasi basarisiz"));
            const sonuclar = String(stdout || "")
                .split(/\r?\n/)
                .map((satir) => satir.trim())
                .filter(Boolean)
                .slice(0, 10)
                .map((satir) => {
                    try {
                        return JSON.parse(satir);
                    } catch {
                        return null;
                    }
                })
                .filter((veri) => veri && veri.id)
                .map((veri) => ({
                    id: String(veri.id),
                    url:
                        veri.webpage_url ||
                        `https://www.youtube.com/watch?v=${encodeURIComponent(veri.id)}`,
                    baslik: String(veri.title || "Basliksiz video").slice(
                        0,
                        200,
                    ),
                    kanal: String(veri.channel || veri.uploader || "").slice(
                        0,
                        100,
                    ),
                    sure: Number(veri.duration || 0),
                    kucukResim:
                        veri.thumbnail ||
                        `https://i.ytimg.com/vi/${encodeURIComponent(veri.id)}/hqdefault.jpg`,
                    yayinTarihi: String(veri.upload_date || ""),
                }));

            cb(null, sonuclar);
        },
    );
}
function indir(url, format, kalite, cb, baslik) {
    const id = uuid();
    const hedef = path.join(GECICI_KLASOR, id + "." + format);
    let args;
    if (format === "mp3") {
        args = [
            "--no-warnings",
            "-f",
            "bestaudio/best",
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "-o",
            hedef,
            "--no-playlist",
            url,
        ];
    } else if (format === "wav") {
        args = [
            "--no-warnings",
            "-f",
            "bestaudio/best",
            "-x",
            "--audio-format",
            "wav",
            "-o",
            hedef,
            "--no-playlist",
            url,
        ];
    } else {
        const yukseklik = (
            kalite ||
            ayarlar.tumunuAl().varsayilanKalite ||
            "720p"
        ).replace("p", "");
        const bilgi = platformTespit(url);
        if (
            bilgi &&
            (bilgi.platform === "youtube" ||
                bilgi.platform === "youtube_shorts")
        ) {
            args = [
                "--no-warnings",
                "-f",
                `best[protocol*=m3u8][ext=mp4][height<=${yukseklik}][vcodec^=avc1]/best[protocol*=m3u8][ext=mp4][height<=${yukseklik}]/bestvideo[ext=mp4][height<=${yukseklik}][vcodec^=avc1]+bestaudio[ext=m4a]/best[ext=mp4][height<=${yukseklik}][vcodec^=avc1]/bestvideo[ext=mp4][height<=${yukseklik}]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
                "--merge-output-format",
                "mp4",
                "-o",
                hedef,
                "--no-playlist",
                url,
            ];
        } else {
            args = [
                "--no-warnings",
                "-f",
                `best[ext=mp4][height<=${yukseklik}][vcodec^=avc1]/best[ext=mp4][height<=${yukseklik}][vcodec!*=hev1][vcodec!*=hvc1]/best[ext=mp4][height<=${yukseklik}]/best[ext=mp4]/best`,
                "-o",
                hedef,
                "--no-playlist",
                url,
            ];
        }
    }
    const ffmpegKlasoru = araclar.ffmpegKlasoru();
    const temelArgs = args;
    ytDlpCalistir(
        (js) => [
            ...(ffmpegKlasoru ? ["--ffmpeg-location", ffmpegKlasoru] : []),
            ...js,
            ...temelArgs,
        ],
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
        (hata, stdout, stderr) => {
            if (hata)
                return cb(
                    new Error(
                        (stderr || stdout || "Indirme basarisiz")
                            .trim()
                            .slice(0, 500),
                    ),
                );
            if (!fs.existsSync(hedef)) {
                const detay = String(stderr || stdout || "")
                    .trim()
                    .slice(0, 500);
                return cb(
                    new Error(
                        detay
                            ? `Dosya olusturulamadi: ${detay}`
                            : "Dosya olusturulamadi",
                    ),
                );
            }
            cb(null, {
                id,
                dosyaYolu: hedef,
                format,
                dosyaAdi: dosyaAdiHazirla(baslik),
            });
        },
    );
}
function kirp(url, baslangic, bitis, kalite, cb, baslik) {
    const sure = bitis - baslangic;
    if (
        !Number.isFinite(baslangic) ||
        !Number.isFinite(bitis) ||
        baslangic < 0 ||
        sure <= 0 ||
        sure > 1800
    ) {
        return cb(new Error("Gecersiz kirpma araligi"));
    }
    indir(
        url,
        "mp4",
        kalite,
        (hata, kaynak) => {
            if (hata) return cb(hata);
            const id = uuid();
            const hedef = path.join(GECICI_KLASOR, id + ".mp4");
            const args = [
                "-y",
                "-ss",
                String(baslangic),
                "-i",
                kaynak.dosyaYolu,
                "-t",
                String(sure),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                hedef,
            ];
            execFile(
                araclar.ffmpegKomutu(),
                args,
                {
                    windowsHide: true,
                    timeout: 600000,
                    maxBuffer: 10 * 1024 * 1024,
                },
                (ffmpegHatasi, stdout, stderr) => {
                    try {
                        fs.unlinkSync(kaynak.dosyaYolu);
                    } catch {}
                    if (ffmpegHatasi)
                        return cb(
                            new Error(
                                (stderr || stdout || "Kirpma basarisiz")
                                    .trim()
                                    .slice(0, 500),
                            ),
                        );
                    if (!fs.existsSync(hedef))
                        return cb(new Error("Kirpilmis dosya olusturulamadi"));
                    cb(null, {
                        id,
                        dosyaYolu: hedef,
                        format: "mp4",
                        dosyaAdi: dosyaAdiHazirla(baslik),
                    });
                },
            );
        },
        baslik,
    );
}
module.exports = {
    medyaBilgisiAl,
    youtubeAra,
    indir,
    kirp,
    aktifIndirmeler,
    aktifIndirmeEkle,
    aktifIndirmeGuncelle,
    aktifIndirmeKaldir,
};
