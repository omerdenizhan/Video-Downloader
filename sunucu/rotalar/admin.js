"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const db = require("../../veritabani/veritabani");
const { aktifIndirmeler } = require("../servisler/indirici");
const ayarlar = require("../servisler/ayarlar");
const yonlendirici = express.Router();
const PROJE_KLASORU = path.join(__dirname, "..", "..");
function hataKategorisi(mesaj) {
    const metin = String(mesaj || "").toLowerCase();
    if (/yt-dlp|youtube|extractor|ejs|javascript runtime/.test(metin))
        return "yt-dlp";
    if (
        /timeout|timed out|bağlantı|baglanti|network|socket|econn|erişim|erisim/.test(
            metin,
        )
    )
        return "Bağlantı";
    if (
        /ffmpeg|format|mp3|mp4|wav|codec|dosya oluşturulamadı|dosya olusturulamadi/.test(
            metin,
        )
    )
        return "Format / Dosya";
    if (
        /veritabanı|veritabani|database|sunucu|server|eaddrinuse|node/.test(
            metin,
        )
    )
        return "Sunucu";
    return "Diğer";
}
function dosyaIstatistigiAl(klasor) {
    let dosyaSayisi = 0;
    let toplamBoyut = 0;
    const tara = (mevcut) => {
        let girdiler;
        try {
            girdiler = fs.readdirSync(mevcut, { withFileTypes: true });
        } catch {
            return;
        }
        girdiler.forEach((girdi) => {
            const tamYol = path.join(mevcut, girdi.name);
            if (girdi.isDirectory()) return tara(tamYol);
            try {
                dosyaSayisi += 1;
                toplamBoyut += fs.statSync(tamYol).size;
            } catch {}
        });
    };
    if (fs.existsSync(klasor)) tara(klasor);
    return {
        dosyaSayisi,
        boyutMb: Number((toplamBoyut / 1024 / 1024).toFixed(2)),
    };
}
async function sistemDurumuAl() {
    const araclar = require("../servisler/araclar");
    araclar.yenile();
    const ytDlp = {
        basari: !!araclar.durum.ytDlp.komut,
        cikti: araclar.durum.ytDlp.surum || "",
    };
    const ffmpeg = {
        basari: !!araclar.durum.ffmpeg.komut,
        cikti: "ffmpeg version " + (araclar.durum.ffmpeg.surum || ""),
    };
    const geciciKlasor = path.join(PROJE_KLASORU, "gecici");
    let veritabani = { durum: "iyi", mesaj: "Bağlantı çalışıyor." };
    try {
        db.tek("SELECT 1 AS kontrol");
    } catch (hata) {
        veritabani = {
            durum: "hata",
            mesaj: hata.message || "Veritabanına erişilemedi.",
        };
    }
    const gecici = dosyaIstatistigiAl(geciciKlasor);
    return {
        basari: true,
        zaman: new Date().toISOString(),
        node: { durum: "iyi", surum: process.version },
        javascriptRuntime: {
            durum: "iyi",
            surum: process.version,
            mesaj: "yt-dlp için Node.js etkin.",
        },
        ytDlp: {
            durum: ytDlp.basari ? "iyi" : "hata",
            surum: ytDlp.basari ? ytDlp.cikti.split(/\r?\n/)[0] : "-",
            mesaj: ytDlp.basari
                ? "Çalışmaya hazır."
                : "yt-dlp bulunamadı veya çalıştırılamadı. " +
                  (araclar.durum.notlar?.ytDlp || []).slice(-3).join(" | "),
        },
        ffmpeg: {
            durum: ffmpeg.basari ? "iyi" : "hata",
            surum: ffmpeg.basari
                ? (ffmpeg.cikti.match(/ffmpeg version\s+([^\s]+)/i) || [])[1] ||
                  "-"
                : "-",
            mesaj: ffmpeg.basari
                ? "Çalışmaya hazır."
                : "FFmpeg bulunamadı veya çalıştırılamadı. " +
                  (araclar.durum.notlar?.ffmpeg || []).slice(-3).join(" | "),
        },
        geciciKlasor: {
            durum: fs.existsSync(geciciKlasor) ? "iyi" : "uyari",
            ...gecici,
            mesaj: fs.existsSync(geciciKlasor)
                ? "Geçici klasör erişilebilir."
                : "Geçici klasör henüz oluşturulmadı.",
        },
        veritabani,
    };
}
function adminKorumasi(req, res, next) {
    if (req.session && req.session.adminGiris) return next();
    res.redirect("/admin/giris");
}
function adminOlayiKaydet(req, kullanici, basarili, olay) {
    try {
        db.calistir(
            "INSERT INTO admin_giris_loglari (kullanici, basarili, ip_hash, olay) VALUES (?, ?, ?, ?)",
            [kullanici || "", basarili ? 1 : 0, req.ipHash || "", olay],
        );
    } catch {}
}
function adminGirisKilitliMi(req, kullanici) {
    const baslangic = Math.floor(Date.now() / 1000) - 15 * 60;
    try {
        const sonuc = db.tek(
            "SELECT COUNT(*) AS sayi FROM admin_giris_loglari WHERE kullanici = ? AND ip_hash = ? AND basarili = 0 AND zaman >= ?",
            [kullanici || "", req.ipHash || "", baslangic],
        );
        return Number(sonuc?.sayi || 0) >= 5;
    } catch {
        return false;
    }
}
yonlendirici.get("/giris", (req, res) => {
    if (req.session.adminGiris) return res.redirect("/admin/panel");
    res.render("admin-giris", { baslik: "Admin Girisi", hata: null });
});
yonlendirici.post("/giris", (req, res) => {
    const { kullanici, sifre } = req.body;
    if (!kullanici || !sifre) {
        adminOlayiKaydet(req, kullanici, false, "Eksik giriş bilgisi");
        return res.render("admin-giris", {
            baslik: "Admin Girisi",
            hata: "Bilgileri eksiksiz girin.",
        });
    }
    if (adminGirisKilitliMi(req, kullanici)) {
        adminOlayiKaydet(req, kullanici, false, "Geçici giriş kilidi");
        return res.render("admin-giris", {
            baslik: "Admin Girisi",
            hata: "Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.",
        });
    }
    const yonetici = db.tek(
        "SELECT * FROM yoneticiler WHERE kullanici_adi = ?",
        [kullanici],
    );
    if (!yonetici || !bcrypt.compareSync(sifre, yonetici.sifre_hash)) {
        adminOlayiKaydet(
            req,
            kullanici,
            false,
            "Hatalı kullanıcı adı veya şifre",
        );
        return res.render("admin-giris", {
            baslik: "Admin Girisi",
            hata: "Kullanici adi veya sifre hatali.",
        });
    }
    req.session.regenerate((hata) => {
        if (hata) {
            adminOlayiKaydet(req, kullanici, false, "Oturum oluşturulamadı");
            return res.render("admin-giris", {
                baslik: "Admin Girisi",
                hata: "Oturum oluşturulamadı. Tekrar deneyin.",
            });
        }
        req.session.adminGiris = true;
        req.session.adminAdi = yonetici.kullanici_adi;
        adminOlayiKaydet(req, kullanici, true, "Başarılı giriş");
        res.redirect("/admin/panel");
    });
});
yonlendirici.get("/cikis", (req, res) => {
    const kullanici = req.session?.adminAdi || "";
    adminOlayiKaydet(req, kullanici, true, "Çıkış yapıldı");
    req.session.destroy(() => res.redirect("/admin/giris"));
});
yonlendirici.get("/panel", adminKorumasi, (req, res) => {
    const toplamIndirme = db.tek(
        "SELECT COUNT(*) as sayi FROM islemler WHERE durum='tamamlandi'",
    ) || { sayi: 0 };
    const toplamZiyaretci = db.tek(
        "SELECT COUNT(DISTINCT ip_hash) as sayi FROM ziyaretciler",
    ) || { sayi: 0 };
    const platformIstatistik = db.sorgu(
        "SELECT platform, COUNT(*) as sayi FROM islemler WHERE durum='tamamlandi' GROUP BY platform ORDER BY sayi DESC",
    );
    const formatIstatistik = db.sorgu(
        "SELECT format, COUNT(*) as sayi FROM islemler WHERE durum='tamamlandi' GROUP BY format ORDER BY sayi DESC",
    );
    const sonIslemler = db.sorgu(
        "SELECT * FROM islemler ORDER BY olusturma_zamani DESC LIMIT 20",
    );
    const hatalar = db.sorgu(
        "SELECT * FROM hatalar WHERE mesaj NOT LIKE '%EADDRINUSE%' ORDER BY zaman DESC LIMIT 20",
    );
    const sidebarGenislik = ayarlar.tumunuAl().sidebarGenislik;
    res.render("admin-panel", {
        baslik: "Admin Paneli",
        adminAdi: req.session.adminAdi,
        toplamIndirme: toplamIndirme.sayi,
        toplamZiyaretci: toplamZiyaretci.sayi,
        platformIstatistik,
        formatIstatistik,
        sonIslemler,
        hatalar,
        sidebarGenislik,
        sidebarMin: ayarlar.SIDEBAR_MIN,
        sidebarMax: ayarlar.SIDEBAR_MAX,
    });
});
yonlendirici.get("/sistem-durumu", adminKorumasi, async (req, res) => {
    try {
        res.json(await sistemDurumuAl());
    } catch (hata) {
        res.status(500).json({
            basari: false,
            mesaj: hata.message || "Sistem durumu alınamadı.",
        });
    }
});
yonlendirici.get("/istatistikler", adminKorumasi, (req, res) => {
    const secilenAralik = Number(req.query.aralik);
    const aralik = [7, 30, 90].includes(secilenAralik) ? secilenAralik : 7;
    const simdi = new Date();
    const baslangic = new Date(simdi);
    baslangic.setHours(0, 0, 0, 0);
    baslangic.setDate(baslangic.getDate() - (aralik - 1));
    const baslangicZamani = Math.floor(baslangic.getTime() / 1000);
    const islemler = db.sorgu(
        "SELECT platform, format, durum, olusturma_zamani FROM islemler WHERE olusturma_zamani >= ?",
        [baslangicZamani],
    );
    const ziyaretciler = db.sorgu(
        "SELECT DISTINCT ip_hash FROM ziyaretciler WHERE zaman >= ?",
        [baslangicZamani],
    );
    const gunler = [];
    for (let i = 0; i < aralik; i += 1) {
        const gun = new Date(baslangic);
        gun.setDate(baslangic.getDate() + i);
        gunler.push({
            tarih: gun.toISOString().slice(0, 10),
            etiket: gun.toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "short",
            }),
            toplam: 0,
            basarili: 0,
            hatali: 0,
        });
    }
    const gunHaritasi = new Map(gunler.map((gun) => [gun.tarih, gun]));
    const platformlar = {};
    const formatlar = {};
    islemler.forEach((islem) => {
        const tarih = new Date(Number(islem.olusturma_zamani || 0) * 1000)
            .toISOString()
            .slice(0, 10);
        const gun = gunHaritasi.get(tarih);
        if (gun) {
            gun.toplam += 1;
            if (islem.durum === "tamamlandi") gun.basarili += 1;
            if (islem.durum === "hata") gun.hatali += 1;
        }
        if (islem.durum === "tamamlandi") {
            platformlar[islem.platform] =
                (platformlar[islem.platform] || 0) + 1;
            formatlar[islem.format] = (formatlar[islem.format] || 0) + 1;
        }
    });
    const basarili = islemler.filter(
        (islem) => islem.durum === "tamamlandi",
    ).length;
    const hatali = islemler.filter((islem) => islem.durum === "hata").length;
    res.json({
        basari: true,
        aralik,
        baslangic: baslangic.toISOString(),
        bitis: simdi.toISOString(),
        ozet: {
            toplam: islemler.length,
            basarili,
            hatali,
            basariOrani: islemler.length
                ? Math.round((basarili / islemler.length) * 100)
                : 0,
            tekilZiyaretci: ziyaretciler.length,
        },
        gunluk: gunler,
        platformlar: Object.entries(platformlar)
            .sort((a, b) => b[1] - a[1])
            .map(([etiket, sayi]) => ({ etiket, sayi })),
        formatlar: Object.entries(formatlar)
            .sort((a, b) => b[1] - a[1])
            .map(([etiket, sayi]) => ({ etiket, sayi })),
    });
});
yonlendirici.get("/hatalar", adminKorumasi, (req, res) => {
    const kategori = String(req.query.kategori || "").trim();
    const kayitlar = db
        .sorgu(
            "SELECT id, mesaj, yol, zaman FROM hatalar WHERE mesaj NOT LIKE '%EADDRINUSE%' ORDER BY zaman DESC LIMIT 100",
        )
        .map((kayit) => ({
            ...kayit,
            kategori: hataKategorisi(kayit.mesaj),
        }));
    const filtrelenmis =
        kategori && kategori !== "Tümü"
            ? kayitlar.filter((kayit) => kayit.kategori === kategori)
            : kayitlar;
    const gruplar = {};
    kayitlar.forEach((kayit) => {
        gruplar[kayit.kategori] = (gruplar[kayit.kategori] || 0) + 1;
    });
    res.json({
        basari: true,
        toplam: filtrelenmis.length,
        gruplar,
        kayitlar: filtrelenmis,
    });
});
yonlendirici.get("/aktif-indirmeler", adminKorumasi, (req, res) => {
    const kayitlar = [...aktifIndirmeler.values()]
        .sort((a, b) => Number(b.baslangic || 0) - Number(a.baslangic || 0))
        .map((kayit) => ({
            ...kayit,
            gecenSaniye: Math.max(
                0,
                Math.floor(
                    ((kayit.bitis || Date.now()) - kayit.baslangic) / 1000,
                ),
            ),
        }));
    res.json({
        basari: true,
        aktif: kayitlar.filter((kayit) => kayit.durum === "isleniyor"),
        sonlanan: kayitlar.filter((kayit) => kayit.durum !== "isleniyor"),
    });
});
yonlendirici.get("/ayarlar", adminKorumasi, (req, res) => {
    res.json({ basari: true, ayarlar: ayarlar.tumunuAl() });
});
yonlendirici.post("/ayarlar", adminKorumasi, (req, res) => {
    const gelen = req.body || {};
    const maksTopluVideo = Number(gelen.maksTopluVideo);
    const geciciDosyaSuresi = Number(gelen.geciciDosyaSuresi);
    const varsayilanKalite = String(gelen.varsayilanKalite || "720p");
    const bakimModu =
        gelen.bakimModu === true ||
        gelen.bakimModu === "true" ||
        gelen.bakimModu === "1";
    if (
        !Number.isInteger(maksTopluVideo) ||
        maksTopluVideo < 1 ||
        maksTopluVideo > 50
    )
        return res.status(400).json({
            basari: false,
            mesaj: "Maksimum playlist sayısı 1-50 arasında olmalı.",
        });
    if (
        !Number.isInteger(geciciDosyaSuresi) ||
        geciciDosyaSuresi < 300000 ||
        geciciDosyaSuresi > 86400000
    )
        return res.status(400).json({
            basari: false,
            mesaj: "Dosya saklama süresi 5 dakika-24 saat arasında olmalı.",
        });
    if (!["360p", "480p", "720p", "1080p"].includes(varsayilanKalite))
        return res
            .status(400)
            .json({ basari: false, mesaj: "Geçersiz varsayılan kalite." });
    try {
        ayarlar.guncelle("maks_toplu_video", maksTopluVideo);
        ayarlar.guncelle("gecici_dosya_suresi", geciciDosyaSuresi);
        ayarlar.guncelle("varsayilan_kalite", varsayilanKalite);
        ayarlar.guncelle("bakim_modu", bakimModu ? 1 : 0);
        res.json({
            basari: true,
            mesaj: "Ayarlar güncellendi.",
            ayarlar: ayarlar.tumunuAl(),
        });
    } catch {
        res.status(500).json({
            basari: false,
            mesaj: "Ayarlar kaydedilemedi.",
        });
    }
});
yonlendirici.get("/guvenlik-olaylari", adminKorumasi, (req, res) => {
    const olaylar = db.sorgu(
        "SELECT kullanici, basarili, olay, zaman FROM admin_giris_loglari ORDER BY zaman DESC LIMIT 50",
    );
    res.json({ basari: true, olaylar });
});
yonlendirici.get("/kullanim-analizi", adminKorumasi, (req, res) => {
    const secilenAralik = Number(req.query.aralik);
    const aralik = [7, 30, 90].includes(secilenAralik) ? secilenAralik : 30;
    const baslangic = Math.floor(
        (Date.now() - aralik * 24 * 60 * 60 * 1000) / 1000,
    );
    const olaylar = db.sorgu(
        "SELECT olay, zaman FROM kullanim_olaylari WHERE zaman >= ?",
        [baslangic],
    );
    const islemler = db.sorgu(
        "SELECT platform, format, olusturma_zamani FROM islemler WHERE olusturma_zamani >= ?",
        [baslangic],
    );
    const ziyaretciler = db.sorgu(
        "SELECT DISTINCT ip_hash FROM ziyaretciler WHERE zaman >= ?",
        [baslangic],
    );
    const saatler = Array.from({ length: 24 }, (_, saat) => ({
        saat,
        sayi: 0,
    }));
    const sayac = { arama: 0, analiz: 0, indirme: 0 };
    olaylar.forEach((olay) => {
        if (sayac[olay.olay] !== undefined) sayac[olay.olay] += 1;
        saatler[new Date(Number(olay.zaman) * 1000).getHours()].sayi += 1;
    });
    islemler.forEach((islem) => {
        sayac.indirme += 1;
        saatler[
            new Date(Number(islem.olusturma_zamani) * 1000).getHours()
        ].sayi += 1;
    });
    const enYogunSaat = saatler.reduce(
        (enIyi, saat) => (saat.sayi > enIyi.sayi ? saat : enIyi),
        saatler[0],
    );
    const platformlar = {};
    const formatlar = {};
    islemler.forEach((islem) => {
        platformlar[islem.platform] = (platformlar[islem.platform] || 0) + 1;
        formatlar[islem.format] = (formatlar[islem.format] || 0) + 1;
    });
    const sirala = (degerler) =>
        Object.entries(degerler)
            .sort((a, b) => b[1] - a[1])
            .map(([etiket, sayi]) => ({ etiket, sayi }));
    res.json({
        basari: true,
        aralik,
        ozet: {
            ...sayac,
            tekilZiyaretci: ziyaretciler.length,
            enYogunSaat: enYogunSaat.sayi
                ? `${String(enYogunSaat.saat).padStart(2, "0")}:00`
                : "-",
        },
        saatler,
        platformlar: sirala(platformlar),
        formatlar: sirala(formatlar),
    });
});
yonlendirici.post("/sidebar-genislik", adminKorumasi, (req, res) => {
    const genislik = ayarlar.sidebarSinirla(req.body?.genislik);
    try {
        ayarlar.guncelle("sidebar_genislik", genislik);
        res.json({ basari: true, genislik });
    } catch {
        res.status(500).json({ basari: false, mesaj: "Sidebar genişliği kaydedilemedi." });
    }
});
yonlendirici.post("/kullanici-adi-degistir", adminKorumasi, (req, res) => {
    const { yeniKullaniciAdi, mevcutSifre } = req.body || {};
    const yeniAd = String(yeniKullaniciAdi || "").trim();
    if (!yeniAd || yeniAd.length < 3 || yeniAd.length > 32) {
        return res.json({ basari: false, mesaj: "Kullanıcı adı 3-32 karakter arasında olmalıdır." });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(yeniAd)) {
        return res.json({ basari: false, mesaj: "Kullanıcı adı sadece harf, rakam ve . _ - içerebilir." });
    }
    const yonetici = db.tek(
        "SELECT * FROM yoneticiler WHERE kullanici_adi = ?",
        [req.session.adminAdi],
    );
    if (!yonetici || !bcrypt.compareSync(String(mevcutSifre || ""), yonetici.sifre_hash)) {
        adminOlayiKaydet(
            req,
            req.session.adminAdi,
            false,
            "Hatalı mevcut şifre (Kullanıcı adı değişimi)",
        );
        return res.json({ basari: false, mesaj: "Mevcut şifre hatalı." });
    }
    const varMi = db.tek(
        "SELECT id FROM yoneticiler WHERE kullanici_adi = ? AND id != ?",
        [yeniAd, yonetici.id],
    );
    if (varMi) {
        return res.json({ basari: false, mesaj: "Bu kullanıcı adı zaten kullanılıyor." });
    }
    db.calistir(
        "UPDATE yoneticiler SET kullanici_adi = ? WHERE id = ?",
        [yeniAd, yonetici.id],
    );
    const eskiAd = req.session.adminAdi;
    req.session.adminAdi = yeniAd;
    adminOlayiKaydet(req, yeniAd, true, `Kullanıcı adı değiştirildi: ${eskiAd} -> ${yeniAd}`);
    res.json({ basari: true, mesaj: "Kullanıcı adı başarıyla güncellendi.", yeniKullaniciAdi: yeniAd });
});
yonlendirici.post("/sifre-degistir", adminKorumasi, (req, res) => {
    const { mevcutSifre, yeniSifre, yeniSifreTekrar } = req.body;
    const yonetici = db.tek(
        "SELECT * FROM yoneticiler WHERE kullanici_adi = ?",
        [req.session.adminAdi],
    );
    if (!bcrypt.compareSync(mevcutSifre, yonetici.sifre_hash)) {
        adminOlayiKaydet(
            req,
            req.session.adminAdi,
            false,
            "Hatalı mevcut şifre",
        );
        return res.json({ basari: false, mesaj: "Mevcut sifre hatali." });
    }
    if (yeniSifre !== yeniSifreTekrar || yeniSifre.length < 8)
        return res.json({
            basari: false,
            mesaj: "Sifreler eslesmiyor veya cok kisa.",
        });
    db.calistir(
        "UPDATE yoneticiler SET sifre_hash = ? WHERE kullanici_adi = ?",
        [bcrypt.hashSync(yeniSifre, 12), req.session.adminAdi],
    );
    adminOlayiKaydet(req, req.session.adminAdi, true, "Şifre değiştirildi");
    res.json({ basari: true, mesaj: "Sifre guncellendi." });
});
module.exports = yonlendirici;
