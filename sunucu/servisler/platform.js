"use strict";

const IZINLI_ALAN_ADLARI = [
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",
    "instagram.com",
    "www.instagram.com",
    "twitter.com",
    "www.twitter.com",
    "x.com",
    "www.x.com",
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
    "m.tiktok.com",
];
function platformTespit(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (!IZINLI_ALAN_ADLARI.includes(host)) return null;
    if (host.includes("youtube.com") || host === "youtu.be") {
        const shorts = parsed.pathname.startsWith("/shorts/");
        return {
            platform: shorts ? "youtube_shorts" : "youtube",
            ad: shorts ? "YouTube Shorts" : "YouTube",
            ikon: "youtube",
        };
    }
    if (host.includes("instagram.com"))
        return { platform: "instagram", ad: "Instagram", ikon: "instagram" };
    if (host.includes("twitter.com") || host.includes("x.com"))
        return { platform: "twitter", ad: "Twitter / X", ikon: "twitter" };
    if (host.includes("tiktok.com"))
        return { platform: "tiktok", ad: "TikTok", ikon: "tiktok" };
    return null;
}
function urlDogrula(url) {
    if (!url || typeof url !== "string") return false;
    if (url.length > 500) return false;
    const bilgi = platformTespit(url);
    return bilgi !== null;
}
module.exports = { platformTespit, urlDogrula };
