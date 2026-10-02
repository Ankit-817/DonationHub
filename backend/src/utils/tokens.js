const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// --- Access token (short-lived, sent in the response body, kept in
// frontend memory, attached as an Authorization header) ---------------
const generateAccessToken = (user) => {
    return jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );
};

const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

// --- Refresh token (long-lived, opaque random string, stored ONLY as a
// hash in the database, delivered exclusively via an HttpOnly cookie) --
const REFRESH_TOKEN_COOKIE = "refreshToken";

const generateRefreshToken = () => crypto.randomBytes(48).toString("hex");

const hashToken = (token) =>
    crypto
        .createHash("sha256")
        .update(token + (process.env.REFRESH_TOKEN_SECRET || ""))
        .digest("hex");

const refreshExpiresInMs = () => {
    const raw = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
    const match = /^(\d+)([smhd])$/.exec(raw.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return value * unitMs[match[2]];
};

const setRefreshCookie = (res, token) => {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: refreshExpiresInMs(),
        path: "/api/users",
    });
};

const clearRefreshCookie = (res) => {
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/users" });
};

module.exports = {
    generateAccessToken,
    verifyAccessToken,
    generateRefreshToken,
    hashToken,
    refreshExpiresInMs,
    setRefreshCookie,
    clearRefreshCookie,
    REFRESH_TOKEN_COOKIE,
};
