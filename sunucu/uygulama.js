"use strict";

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const path = require("path");
const crypto = require("crypto");
const db = require("../veritabani/veritabani");
const uygulama = express();
const PORT = process.env.PORT || 3000;
function kritikHataKaydet(kaynak, hata) {
    const mesaj = `${kaynak}: ${hata && hata.stack ? hata.stack : hata}`;
    console.error("\n[KRITIK HATA]", mesaj);
    try {
        db.calistir("INSERT INTO hatalar (mesaj, yol) VALUES (?, ?)", [
            String(mesaj).slice(0, 500),
            kaynak,
        ]);
    } catch {}
}
process.on("uncaughtException", (hata) => {
    kritikHataKaydet("uncaughtException", hata);
});
process.on("unhandledRejection", (hata) => {
    kritikHataKaydet("unhandledRejection", hata);
});
uygulama.set("view engine", "ejs");
uygulama.set("views", path.join(__dirname, "..", "gorunumler"));
uygulama.set("trust proxy", 1);
uygulama.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                ],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
            },
        },
    }),
);
uygulama.use(cookieParser());
uygulama.use(express.json({ limit: "10kb" }));
uygulama.use(express.urlencoded({ extended: false, limit: "10kb" }));
uygulama.get("/favicon.png", (req, res, next) => {
    res.sendFile(
        path.join(__dirname, "..", "gorunumler", "favicon.png"),
        (hata) => {
            if (hata) next(hata);
        },
    );
});
uygulama.use(express.static(path.join(__dirname, "..", "genel")));
uygulama.use(
    session({
        secret:
            process.env.OTURUM_SIRRI || crypto.randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 8 * 60 * 60 * 1000,
            sameSite: "strict",
            secure: process.env.SESSION_SECURE === "true",
        },
    }),
);
const limitJson = (req, res) =>
    res
        .status(429)
        .json({
            basari: false,
            mesaj: "Çok fazla istek. Lütfen biraz bekleyip tekrar deneyiniz.",
        });
const genelLimit = rateLimit({
    handler: limitJson,
    windowMs: 15 * 60 * 1000,
    max: 200,
    skip: (req) => Boolean(req.session?.adminGiris),
});
const indirmeLimit = rateLimit({
    handler: limitJson,
    windowMs: 60 * 1000,
    max: 5,
    skip: (req) =>
        req.path === "/toplu" ||
        req.path === "/analiz" ||
        req.path === "/onizleme" ||
        req.path.startsWith("/onizleme/") ||
        req.path.startsWith("/dosya/"),
});
const topluIndirmeLimit = rateLimit({
    handler: limitJson,
    windowMs: 15 * 60 * 1000,
    max: 2,
});
const adminLimit = rateLimit({
    handler: limitJson,
    windowMs: 15 * 60 * 1000,
    max: 30,
    skip: (req) => Boolean(req.session?.adminGiris),
});
uygulama.use(genelLimit);
uygulama.use("/indir/toplu", topluIndirmeLimit);
uygulama.use("/indir", indirmeLimit);
uygulama.use("/admin", adminLimit);
uygulama.use((req, res, next) => {
    req.ipHash = crypto
        .createHash("sha256")
        .update(req.ip || "")
        .digest("hex")
        .slice(0, 16);
    try {
        db.calistir("INSERT INTO ziyaretciler (ip_hash) VALUES (?)", [
            req.ipHash,
        ]);
    } catch {}
    next();
});
(async () => {
    try {
        await db.baglan();
        try {
            require("./servisler/araclar").hazirla();
        } catch (h) {
            kritikHataKaydet("araclar", h);
        }
        const anaSayfa = require("./rotalar/ana");
        const indirme = require("./rotalar/indirme");
        const admin = require("./rotalar/admin");
        const temizlik = require("./servisler/temizlik");
        uygulama.use("/", anaSayfa);
        uygulama.use("/indir", indirme);
        uygulama.use("/admin", admin);
        uygulama.use((req, res) => {
            res.status(404).render("404", { baslik: "Sayfa Bulunamadı" });
        });
        uygulama.use((err, req, res, next) => {
            try {
                db.calistir("INSERT INTO hatalar (mesaj, yol) VALUES (?, ?)", [
                    (err.message || "").slice(0, 500),
                    req.path || "/",
                ]);
            } catch {}
            if ((req.originalUrl || "").startsWith("/indir"))
                return res
                    .status(500)
                    .json({
                        basari: false,
                        mesaj: "Sunucu hatası oluştu. Lütfen tekrar deneyiniz.",
                    });
            res.status(500).render("hata", { baslik: "Sunucu Hatası" });
        });
        cron.schedule("*/30 * * * *", () => temizlik.geciciDosyalariTemizle());
        const sunucu = uygulama.listen(PORT, () => {
            console.log("");
            console.log("  ==================================================");
            console.log("   Video İndirici - Çalışıyor");
            console.log("   Adres : http://localhost:" + PORT);
            console.log("   Admin : http://localhost:" + PORT + "/admin/giris");
            console.log("  ==================================================");
            console.log("");
        });
        sunucu.requestTimeout = 0;
        sunucu.timeout = 0;
        sunucu.on("error", (hata) => {
            if (hata.code === "EADDRINUSE") {
                console.error(
                    `[BAŞLATMA HATASI] ${PORT} portu zaten kullanılıyor. Mevcut sunucuyu kapatıp tekrar deneyiniz.`,
                );
            } else {
                kritikHataKaydet("sunucu-dinleme", hata);
            }
            process.exit(1);
        });
    } catch (hata) {
        kritikHataKaydet("uygulama-baslatma", hata);
    }
})();
