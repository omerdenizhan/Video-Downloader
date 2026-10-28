"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");
const db = require("../../veritabani/veritabani");
const { urlDogrula, platformTespit } = require("../servisler/platform");
const {
    medyaBilgisiAl,
    youtubeAra,
    indir,
    kirp,
    aktifIndirmeEkle,
    aktifIndirmeGuncelle,
    aktifIndirmeKaldir,
} = require("../servisler/indirici");
const ayarlar = require("../servisler/ayarlar");
const yonlendirici = express.Router();
function aktifIndirmeyiSonlandir(islemId, durum, mesaj) {
    aktifIndirmeGuncelle(islemId, {
        durum,
        mesaj: mesaj || "",
        bitis: Date.now(),
    });
    setTimeout(() => aktifIndirmeKaldir(islemId), 15000);
}
function indirmeHatasiMesaji(hata) {
    const detay = String(hata?.message || "Indirme basarisiz").slice(0, 500);
    try {
        db.calistir("INSERT INTO hatalar (mesaj, yol) VALUES (?, ?)", [
            detay,
            "indirme",
        ]);
    } catch {}
    if (
        /10013|EACCES|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|Failed to establish|network/i.test(
            detay,
        )
    ) {
        return "YouTube sunucusuna baglanilamadi. Internet ve guvenlik duvari ayarlarini kontrol edin.";
    }
    return "Indirme basarisiz oldu. Lutfen tekrar deneyin.";
}
function kullanimOlayiKaydet(req, olay) {
    try {
        db.calistir(
            "INSERT INTO kullanim_olaylari (olay, ip_hash) VALUES (?, ?)",
            [olay, req.ipHash || ""],
        );
    } catch {}
}
yonlendirici.post("/ara", (req, res) => {
    const sorgu =
        typeof req.body.sorgu === "string" ? req.body.sorgu.trim() : "";
    if (!sorgu || sorgu.length > 120) {
        return res.status(400).json({
            basari: false,
            mesaj: "Lutfen 1-120 karakter arasinda bir arama yazin.",
        });
    }
    kullanimOlayiKaydet(req, "arama");
    youtubeAra(sorgu, (hata, sonuclar) => {
        if (hata)
            return res.status(422).json({
                basari: false,
                mesaj: "YouTube aramasi yapilamadi. Lutfen tekrar deneyin.",
            });
        res.json({ basari: true, sonuclar });
    });
});
yonlendirici.post("/analiz", (req, res) => {
    const { url } = req.body;
    if (!url || !urlDogrula(url)) {
        return res.status(400).json({
            basari: false,
            mesaj: "Gecersiz veya desteklenmeyen baglanti.",
        });
    }
    medyaBilgisiAl(url, (hata, veri) => {
        if (hata)
            return res.status(422).json({
                basari: false,
                mesaj: "Medya bilgisi alinamadi. Baglantıyı kontrol edin.",
            });
        res.json({ basari: true, veri });
    });
});
yonlendirici.post("/onizleme", (req, res) => {
    const { url, baslik } = req.body;
    if (!url || !urlDogrula(url))
        return res
            .status(400)
            .json({ basari: false, mesaj: "Gecersiz baglanti." });
    indir(
        url,
        "mp4",
        "360p",
        (hata, sonuc) => {
            if (hata)
                return res
                    .status(502)
                    .json({ basari: false, mesaj: indirmeHatasiMesaji(hata) });
            res.json({ basari: true, onizlemeId: sonuc.id, sure: 0 });
        },
        baslik,
    );
});
yonlendirici.get("/onizleme/:id", (req, res) => {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id))
        return res.status(400).send("Gecersiz istek");
    const geciciKlasor = path.resolve(__dirname, "..", "..", "gecici");
    const dosyaYolu = path.resolve(geciciKlasor, `${id}.mp4`);
    if (!dosyaYolu.startsWith(geciciKlasor))
        return res.status(403).send("Erisim reddedildi");
    if (!fs.existsSync(dosyaYolu))
        return res.status(404).send("Onizleme bulunamadi");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Type", "video/mp4");
    res.sendFile(dosyaYolu);
});
yonlendirici.post("/kirp", (req, res) => {
    const { url, baslangic, bitis, kalite, baslik } = req.body;
    const baslangicSayisi = Number(baslangic);
    const bitisSayisi = Number(bitis);
    if (!url || !urlDogrula(url))
        return res
            .status(400)
            .json({ basari: false, mesaj: "Gecersiz baglanti." });
    if (
        !Number.isFinite(baslangicSayisi) ||
        !Number.isFinite(bitisSayisi) ||
        baslangicSayisi < 0 ||
        bitisSayisi <= baslangicSayisi ||
        bitisSayisi - baslangicSayisi > 1800
    ) {
        return res.status(400).json({
            basari: false,
            mesaj: "Gecersiz video araligi. En fazla 30 dakikalik bir klip secin.",
        });
    }
    kullanimOlayiKaydet(req, "analiz");
    const islemId = uuid();
    const platform = platformTespit(url);
    try {
        db.calistir(
            "INSERT INTO islemler (id, platform, format, kalite, durum, ip_hash) VALUES (?, ?, ?, ?, ?, ?)",
            [
                islemId,
                platform?.platform || "bilinmiyor",
                "mp4",
                kalite || "",
                "isleniyor",
                req.ipHash || "",
            ],
        );
    } catch {}
    aktifIndirmeEkle({
        id: islemId,
        baslik: baslik || url,
        format: "mp4",
        kalite: kalite || "",
        platform: platform?.platform || "bilinmiyor",
        tur: "kirpma",
    });
    kirp(
        url,
        baslangicSayisi,
        bitisSayisi,
        kalite,
        (hata, sonuc) => {
            if (hata) {
                try {
                    db.calistir("UPDATE islemler SET durum='hata' WHERE id=?", [
                        islemId,
                    ]);
                } catch {}
                const mesaj = indirmeHatasiMesaji(hata);
                aktifIndirmeyiSonlandir(islemId, "hata", mesaj);
                return res.status(502).json({ basari: false, mesaj });
            }
            try {
                db.calistir(
                    "UPDATE islemler SET durum='tamamlandi', dosya_adi=? WHERE id=?",
                    [sonuc.dosyaAdi, islemId],
                );
            } catch {}
            aktifIndirmeyiSonlandir(islemId, "tamamlandi");
            res.json({
                basari: true,
                indirmeId: sonuc.id,
                format: "mp4",
                dosyaAdi: sonuc.dosyaAdi,
            });
        },
        baslik,
    );
});
yonlendirici.post("/baslat", (req, res) => {
    const { url, format, kalite, baslik } = req.body;
    if (!url || !urlDogrula(url))
        return res
            .status(400)
            .json({ basari: false, mesaj: "Gecersiz baglanti." });
    const izinliFormatlar = ["mp4", "mp3", "wav"];
    if (!izinliFormatlar.includes(format))
        return res
            .status(400)
            .json({ basari: false, mesaj: "Gecersiz format." });

    const islemId = uuid();
    const platform = platformTespit(url);
    try {
        db.calistir(
            "INSERT INTO islemler (id, platform, format, kalite, durum, ip_hash) VALUES (?, ?, ?, ?, ?, ?)",
            [
                islemId,
                platform?.platform || "bilinmiyor",
                format,
                kalite || "",
                "isleniyor",
                req.ipHash || "",
            ],
        );
    } catch {}
    aktifIndirmeEkle({
        id: islemId,
        baslik: baslik || url,
        format,
        kalite: kalite || "",
        platform: platform?.platform || "bilinmiyor",
        tur: "indirme",
    });
    indir(
        url,
        format,
        kalite,
        (hata, sonuc) => {
            if (hata) {
                try {
                    db.calistir("UPDATE islemler SET durum='hata' WHERE id=?", [
                        islemId,
                    ]);
                } catch {}
                const mesaj = indirmeHatasiMesaji(hata);
                aktifIndirmeyiSonlandir(islemId, "hata", mesaj);
                return res.status(502).json({ basari: false, mesaj });
            }
            try {
                db.calistir(
                    "UPDATE islemler SET durum='tamamlandi', dosya_adi=? WHERE id=?",
                    [sonuc.dosyaAdi, islemId],
                );
            } catch {}
            aktifIndirmeyiSonlandir(islemId, "tamamlandi");
            res.json({
                basari: true,
                indirmeId: sonuc.id,
                format: sonuc.format,
                dosyaAdi: sonuc.dosyaAdi,
            });
        },
        baslik,
    );
});
yonlendirici.post("/toplu", async (req, res) => {
    res.setTimeout(0);
    const { videolar, format, kalite } = req.body;
    const izinliFormatlar = ["mp4", "mp3", "wav"];
    const videoListesi = Array.isArray(videolar)
        ? [
              ...new Map(
                  videolar
                      .map((video) =>
                          typeof video === "string"
                              ? { url: video, baslik: "" }
                              : {
                                    url: video?.url,
                                    baslik: video?.baslik || "",
                                },
                      )
                      .filter((video) => video.url)
                      .map((video) => [video.url, video]),
              ).values(),
          ]
        : [];
    const urls = videoListesi.map((video) => video.url);
    const maksTopluVideo = ayarlar.tumunuAl().maksTopluVideo;
    if (!urls.length || urls.length > maksTopluVideo) {
        return res.status(400).json({
            basari: false,
            mesaj: `1 ile ${maksTopluVideo} arasinda video secin.`,
        });
    }
    if (!izinliFormatlar.includes(format)) {
        return res
            .status(400)
            .json({ basari: false, mesaj: "Gecersiz format." });
    }
    if (urls.some((url) => !urlDogrula(url))) {
        return res.status(400).json({
            basari: false,
            mesaj: "Secilen videolardan biri desteklenmiyor.",
        });
    }
    const sonuclar = [];
    for (const video of videoListesi) {
        const { url, baslik } = video;
        const islemId = uuid();
        const platform = platformTespit(url);
        try {
            db.calistir(
                "INSERT INTO islemler (id, platform, format, kalite, durum, ip_hash) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    islemId,
                    platform?.platform || "bilinmiyor",
                    format,
                    kalite || "",
                    "isleniyor",
                    req.ipHash || "",
                ],
            );
        } catch {}
        aktifIndirmeEkle({
            id: islemId,
            baslik: baslik || url,
            format,
            kalite: kalite || "",
            platform: platform?.platform || "bilinmiyor",
            tur: "toplu",
        });
        const sonuc = await new Promise((resolve) =>
            indir(
                url,
                format,
                kalite,
                (hata, veri) => resolve({ hata, veri }),
                baslik,
            ),
        );
        if (sonuc.hata) {
            try {
                db.calistir("UPDATE islemler SET durum='hata' WHERE id=?", [
                    islemId,
                ]);
            } catch {}
            const mesaj = indirmeHatasiMesaji(sonuc.hata);
            aktifIndirmeyiSonlandir(islemId, "hata", mesaj);
            sonuclar.push({ basari: false, url, mesaj });
            continue;
        }
        try {
            db.calistir(
                "UPDATE islemler SET durum='tamamlandi', dosya_adi=? WHERE id=?",
                [sonuc.veri.dosyaAdi, islemId],
            );
        } catch {}
        aktifIndirmeyiSonlandir(islemId, "tamamlandi");
        sonuclar.push({
            basari: true,
            url,
            indirmeId: sonuc.veri.id,
            format: sonuc.veri.format,
            dosyaAdi: sonuc.veri.dosyaAdi,
        });
    }
    res.json({
        basari: sonuclar.some((sonuc) => sonuc.basari),
        sonuclar,
        tamamlanan: sonuclar.filter((sonuc) => sonuc.basari).length,
        basarisiz: sonuclar.filter((sonuc) => !sonuc.basari).length,
    });
});
yonlendirici.get("/dosya/:id/:format", (req, res) => {
    const { id, format } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id))
        return res.status(400).send("Gecersiz istek");
    const izinliFormatlar = ["mp4", "mp3", "wav"];
    if (!izinliFormatlar.includes(format))
        return res.status(400).send("Gecersiz format");
    const geciciKlasor = path.resolve(__dirname, "..", "..", "gecici");
    const dosyaYolu = path.resolve(geciciKlasor, `${id}.${format}`);
    if (!dosyaYolu.startsWith(geciciKlasor))
        return res.status(403).send("Erisim reddedildi");
    if (!fs.existsSync(dosyaYolu)) {
        return res.status(404).json({
            basari: false,
            mesaj: "Dosyanin suresi dolmus veya dosya bulunamadi.",
        });
    }
    const mimeMap = { mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav" };
    const istenenAd = typeof req.query.ad === "string" ? req.query.ad : "";
    const dosyaAdi =
        istenenAd
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/[. ]+$/, "")
            .slice(0, 150) || "dosya";
    const tamDosyaAdi = `${dosyaAdi}.${format}`;
    const asciiDosyaAdi =
        dosyaAdi
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\x20-\x7E]/g, "_") || "dosya";
    const asciiTamDosyaAdi = `${asciiDosyaAdi}.${format}`;
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiTamDosyaAdi}"; filename*=UTF-8''${encodeURIComponent(tamDosyaAdi)}`,
    );
    res.setHeader("Content-Type", mimeMap[format]);
    res.sendFile(dosyaYolu);
});
module.exports = yonlendirici;
