const mongoose = require("mongoose");
const { ApiError } = require("../utils/errorHandler");

// Small, dependency-free validators used as the first line of an Express
// route handler (`validate.isObjectId("id")`, etc). Kept intentionally
// simple and centralized here rather than scattering ad hoc checks across
// controllers - spec #10 asks for consistent input validation, not
// necessarily a particular library.

const isObjectId = (paramName) => (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return next(new ApiError(400, `Invalid ${paramName}`));
    }
    next();
};

const MAX_TEXT_LENGTH = {
    short: 120, // names, titles
    long: 2000, // descriptions, chat messages
};

const sanitizeText = (value, max = MAX_TEXT_LENGTH.long) => {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, max);
};

// Validates the body fields shared by donation/request creation forms.
// Throws ApiError(400, ...) on the first problem found so controllers can
// call this once at the top instead of repeating `if (!x) throw...` chains.
const requireFields = (body, fields) => {
    for (const f of fields) {
        if (body[f] === undefined || body[f] === null || body[f] === "") {
            throw new ApiError(400, `Missing required field: ${f}`);
        }
    }
};

const isValidQuantity = (q) => Number.isFinite(Number(q)) && Number(q) >= 1 && Number(q) <= 10000;

const isValidCoordinates = (coords) =>
    coords &&
    typeof coords.lat === "number" &&
    typeof coords.lng === "number" &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180;

module.exports = {
    isObjectId,
    sanitizeText,
    requireFields,
    isValidQuantity,
    isValidCoordinates,
    MAX_TEXT_LENGTH,
};
