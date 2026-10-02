const express = require("express");
const router = express.Router();
const { getMessagesByTransaction, sendMessage, markMessagesAsRead } = require("../controllers/message");
const { authMiddleware } = require("../middlewares/auth");
const { chatLimiter } = require("../middlewares/rateLimit");

router.use(authMiddleware);

router.get("/:transactionId", getMessagesByTransaction);
router.post("/:transactionId", chatLimiter, sendMessage);
router.patch("/:transactionId/read", markMessagesAsRead);

module.exports = router;
