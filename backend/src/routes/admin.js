const express = require("express");
const router = express.Router();
const { getDashboardStats, listUsersAdmin, setUserBanStatus, listDonationsAdmin } = require("../controllers/admin");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.use(authMiddleware, adminMiddleware);

router.get("/stats", getDashboardStats);
router.get("/users", listUsersAdmin);
router.patch("/users/:id/ban", setUserBanStatus);
router.get("/donations", listDonationsAdmin);

module.exports = router;
