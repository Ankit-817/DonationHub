const express = require("express");
const router = express.Router();
const {
    registerUser,
    loginUser,
    refreshSession,
    logoutUser,
    authCheck,
    getUser,
    updateUser,
    deleteUser,
} = require("../controllers/user");
const { authMiddleware } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/rateLimit");
const { isObjectId } = require("../middlewares/validate");

// Public - brute-force/spam protected (spec #11)
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/refresh", authLimiter, refreshSession);

// Logout only needs the refresh cookie, so it works even if the access
// token already expired - a user should always be able to log out.
router.post("/logout", logoutUser);

// Authenticated
router.get("/authCheck", authMiddleware, authCheck);
router.get("/:id", authMiddleware, isObjectId("id"), getUser);
router.patch("/:id", authMiddleware, isObjectId("id"), updateUser);
router.delete("/:id", authMiddleware, isObjectId("id"), deleteUser);

module.exports = router;
