const express = require("express");
const { createDonation, getDonations, getDonation, getUserDonations } = require("../controllers/donation");
const { authMiddleware } = require("../middlewares/auth");
const { upload } = require("../middlewares/cloudinary");
const { createLimiter } = require("../middlewares/rateLimit");
const { isObjectId } = require("../middlewares/validate");

const router = express.Router();

router.get("/", authMiddleware, getDonations);
router.get("/mine", authMiddleware, getUserDonations);
router.post("/", authMiddleware, createLimiter, upload.array("images", 3), createDonation);
router.get("/:id", authMiddleware, isObjectId("id"), getDonation);

module.exports = router;
