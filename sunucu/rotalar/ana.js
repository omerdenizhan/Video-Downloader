"use strict";

const express = require("express");
const yonlendirici = express.Router();
yonlendirici.get("/", (req, res) => {
    res.render("ana", { baslik: "Video İndirici" });
});
module.exports = yonlendirici;
