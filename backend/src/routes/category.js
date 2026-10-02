const express = require("express");
const router = express.Router();
const { listCategories, suggestCategory, createCategory } = require("../controllers/category");
const { authMiddleware } = require("../middlewares/auth");
const { aiLimiter, createLimiter } = require("../middlewares/rateLimit");

// Listing is public read-only data (needed on the signed-out browse page
// too), so it isn't behind authMiddleware.
router.get("/", listCategories);

router.post("/suggest", authMiddleware, aiLimiter, suggestCategory);
router.post("/", authMiddleware, createLimiter, createCategory);

module.exports = router;
