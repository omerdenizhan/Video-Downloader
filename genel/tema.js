(function () {
    "use strict";
    var ANAHTAR = "tema";
    var kok = document.documentElement;
    var SIMGE = {
        ay: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
        gunes: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    };
    function kayitli() {
        try {
            return localStorage.getItem(ANAHTAR);
        } catch (e) {
            return null;
        }
    }
    function kaydet(t) {
        try {
            localStorage.setItem(ANAHTAR, t);
        } catch (e) { }
    }
    function sistemTemasi() {
        return window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "karanlik"
            : "aydinlik";
    }
    function dugmeleriGuncelle(t) {
        var karanlik = t === "karanlik";
        var dugmeler = document.querySelectorAll("[data-tema-btn]");
        for (var i = 0; i < dugmeler.length; i++) {
            var d = dugmeler[i];
            d.innerHTML = karanlik ? SIMGE.gunes : SIMGE.ay;
            var etiket = karanlik ? "Aydınlık moda geç" : "Karanlık moda geç";
            d.setAttribute("aria-label", etiket);
            d.setAttribute("title", etiket);
            d.setAttribute("aria-pressed", String(karanlik));
        }
    }
    function uygula(t) {
        kok.setAttribute("data-tema", t);
        kok.style.colorScheme = karanlikMi(t) ? "dark" : "light";
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta)
            meta.setAttribute("content", karanlikMi(t) ? "#0e0f1f" : "#eef0f8");
        dugmeleriGuncelle(t);
    }
    function karanlikMi(t) {
        return t === "karanlik";
    }
    function degistir() {
        var yeni =
            kok.getAttribute("data-tema") === "karanlik"
                ? "aydinlik"
                : "karanlik";
        kaydet(yeni);
        uygula(yeni);
    }
    uygula(kayitli() || sistemTemasi());
    document.addEventListener("DOMContentLoaded", function () {
        dugmeleriGuncelle(kok.getAttribute("data-tema"));
    });
    document.addEventListener("click", function (e) {
        var hedef =
            e.target && e.target.closest
                ? e.target.closest("[data-tema-btn]")
                : null;
        if (hedef) degistir();
    });
    if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        var izle = function () {
            if (!kayitli()) uygula(sistemTemasi());
        };
        if (mq.addEventListener) mq.addEventListener("change", izle);
        else if (mq.addListener) mq.addListener(izle);
    }
    window.temaDegistir = degistir;
})();
