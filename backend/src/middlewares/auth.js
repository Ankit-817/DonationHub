const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokens");

// Access tokens are short-lived and live in frontend memory, so they are
// sent as a Bearer header rather than a cookie. The refresh token is the
// only thing that ever travels as a cookie (see utils/tokens.js).
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = await User.findById(decoded.userId).select("-password");

        if (!req.user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        if (req.user.isBanned) {
            return res.status(403).json({ success: false, message: "Your account has been suspended." });
        }

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Access token expired" });
        }
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

const adminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ success: false, message: "Access denied. Admins only." });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware };
