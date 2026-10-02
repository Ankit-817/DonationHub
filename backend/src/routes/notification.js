const express = require("express");
const router = express.Router();
const { getNotifications, markNotificationAsRead, deleteNotification } = require("../controllers/notification");
const { authMiddleware } = require("../middlewares/auth");

router.use(authMiddleware);

router.get("/", getNotifications);
router.patch("/:notificationId/read", markNotificationAsRead);
router.delete("/:notificationId", deleteNotification);

module.exports = router;
