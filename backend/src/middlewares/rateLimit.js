const rateLimit = require("express-rate-limit");

// Shared JSON shape so rate-limit responses look like every other API
// error (spec #43) instead of express-rate-limit's default plain text.
const handler = (req, res) => {
    res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly." });
};

// General safety net on every API route.
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

// Tight limits on auth endpoints to blunt brute-force/credential-stuffing
// and registration spam (spec #11).
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
    skipSuccessfulRequests: true,
});

// AI calls cost real money per request and have higher latency, so they
// get their own, stricter budget (spec #11/#34).
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

// Creating donations/requests/categories is cheap to spam otherwise.
const createLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

// Chat messages: frequent by design, but still bounded.
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

module.exports = { generalLimiter, authLimiter, aiLimiter, createLimiter, chatLimiter };
