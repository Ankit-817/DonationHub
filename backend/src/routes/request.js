const express = require("express");
const { createRequest, getRequests, getMatchingDonations, getUserRequests } = require("../controllers/request");
const { authMiddleware } = require("../middlewares/auth");
const { createLimiter } = require("../middlewares/rateLimit");
const { isObjectId } = require("../middlewares/validate");

const router = express.Router();

router.get("/", authMiddleware, getRequests);
router.post("/", authMiddleware, createLimiter, createRequest);
router.get("/mine", authMiddleware, getUserRequests);
router.get("/:id/matches", authMiddleware, isObjectId("id"), getMatchingDonations);

module.exports = router;
