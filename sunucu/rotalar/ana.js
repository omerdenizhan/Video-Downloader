"use strict";

const express = require("express");
const yonlendirici = express.Router();
yonlendirici.get("/", (req, res) => {
    res.render("ana", { baslik: "D-Tube Video İndirici" });
});
module.exports = yonlendirici;
