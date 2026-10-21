"use strict";

const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const DB_YOLU = path.join(__dirname, "database.db");
let db = null;
async function baglan() {
    if (db) return db;
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_YOLU)) {
        const dosya = fs.readFileSync(DB_YOLU);
        db = new SQL.Database(dosya);
    } else {
        db = new SQL.Database();
    }
    tablolariOlustur();
    kaydet();
    return db;
}
function kaydet() {
    if (!db) return;
    const veri = db.export();
    fs.writeFileSync(DB_YOLU, Buffer.from(veri));
}
function tablolariOlustur() {
    db.run(`
    CREATE TABLE IF NOT EXISTS yoneticiler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kullanici_adi TEXT UNIQUE NOT NULL,
      sifre_hash TEXT NOT NULL,
      olusturma_zamani INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS islemler (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      format TEXT NOT NULL,
      kalite TEXT,
      durum TEXT NOT NULL DEFAULT 'bekliyor',
      baslik TEXT,
      dosya_adi TEXT,
      ip_hash TEXT,
      olusturma_zamani INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS ziyaretciler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      zaman INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS hatalar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesaj TEXT NOT NULL,
      yol TEXT,
      zaman INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS ayarlar (
      anahtar TEXT PRIMARY KEY,
      deger TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_giris_loglari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kullanici TEXT NOT NULL,
      basarili INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT,
      olay TEXT NOT NULL,
      zaman INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS kullanim_olaylari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      olay TEXT NOT NULL,
      ip_hash TEXT,
      zaman INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    const varsayilanAyarlar = [
        ["maks_toplu_video", "20"],
        ["gecici_dosya_suresi", "3600000"],
        ["varsayilan_kalite", "720p"],
        ["bakim_modu", "0"],
    ];
    varsayilanAyarlar.forEach(([anahtar, deger]) => {
        db.run("INSERT OR IGNORE INTO ayarlar (anahtar, deger) VALUES (?, ?)", [
            anahtar,
            deger,
        ]);
    });
    const stmt = db.prepare("SELECT id FROM yoneticiler LIMIT 1");
    const var_ = stmt.step();
    stmt.free();
    if (!var_) {
        const hash = bcrypt.hashSync("admin123", 12);
        db.run(
            "INSERT INTO yoneticiler (kullanici_adi, sifre_hash) VALUES (?, ?)",
            ["admin", hash],
        );
        kaydet();
    }
}
function sorgu(sql, params) {
    if (!db) throw new Error("DB bagli degil");
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const satirlar = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        satirlar.push(row);
    }
    stmt.free();
    return satirlar;
}
function tek(sql, params) {
    const sonuc = sorgu(sql, params);
    return sonuc[0] || null;
}
function calistir(sql, params) {
    if (!db) throw new Error("DB bagli degil");
    db.run(sql, params || []);
    kaydet();
}
module.exports = { baglan, sorgu, tek, calistir };
