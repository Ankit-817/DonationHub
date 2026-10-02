// Small helper so controllers can `throw new ApiError(404, "...")`
// instead of manually writing res.status().json() everywhere, and so
// every error response has the same { success:false, message } shape.
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

// Wrap an async controller so thrown/rejected errors reach the central
// error handler instead of crashing the process or hanging the request.
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Express error-handling middleware (must be registered last, with 4 args).
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong";

    if (process.env.NODE_ENV !== "production") {
        console.error(err);
    }

    res.status(statusCode).json({
        success: false,
        message,
    });
};

const notFound = (req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
};

module.exports = { ApiError, asyncHandler, errorHandler, notFound };
