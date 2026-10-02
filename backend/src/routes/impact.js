const express = require("express");
const router = express.Router();
const { getImpactStats } = require("../controllers/impact");

router.get("/", getImpactStats);

module.exports = router;
