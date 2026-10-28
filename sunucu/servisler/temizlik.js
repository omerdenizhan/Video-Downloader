"use strict";

const fs = require("fs");
const path = require("path");
const ayarlar = require("./ayarlar");
const GECICI_KLASOR = path.join(__dirname, "..", "..", "gecici");
function geciciDosyalariTemizle() {
    if (!fs.existsSync(GECICI_KLASOR)) return;
    const simdi = Date.now();
    const sure = ayarlar.tumunuAl().geciciDosyaSuresi;
    fs.readdirSync(GECICI_KLASOR).forEach((dosya) => {
        if (dosya === ".gitkeep") return;
        const tam = path.join(GECICI_KLASOR, dosya);
        try {
            const stat = fs.statSync(tam);
            if (simdi - stat.mtimeMs > sure) fs.unlinkSync(tam);
        } catch {}
    });
}
module.exports = { geciciDosyalariTemizle };
