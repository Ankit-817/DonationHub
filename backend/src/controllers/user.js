const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Session = require("../models/Session");
const { ApiError, asyncHandler } = require("../utils/errorHandler");
const {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    refreshExpiresInMs,
    setRefreshCookie,
    clearRefreshCookie,
    REFRESH_TOKEN_COOKIE,
} = require("../utils/tokens");

// Creates a fresh refresh-token session for a user, stores only its hash,
// and sets the HttpOnly cookie. Returns the access token to send back.
const issueSession = async (res, user) => {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await Session.create({
        userId: user._id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshExpiresInMs()),
    });

    setRefreshCookie(res, refreshToken);
    return accessToken;
};

const sanitizeUser = (user) => {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    return obj;
};

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone, address, coordinates } = req.body;

    if (!name || !email || !password || !phone || !address || !coordinates) {
        throw new ApiError(400, "Missing required fields");
    }
    if (coordinates.lat === undefined || coordinates.lng === undefined) {
        throw new ApiError(400, "Location is required");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, "Email already in use");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // isAdmin/isBanned/warnings are never accepted from the client.
    const newUser = await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        coordinates: { lat: coordinates.lat, lng: coordinates.lng },
    });

    const accessToken = await issueSession(res, newUser);

    res.status(201).json({
        success: true,
        data: { user: sanitizeUser(newUser), accessToken },
    });
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, "Email and password are required");

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(400, "Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new ApiError(400, "Invalid credentials");

    if (user.isBanned) {
        throw new ApiError(403, "Your account has been suspended. Contact support if you think this is a mistake.");
    }

    const accessToken = await issueSession(res, user);

    res.status(200).json({
        success: true,
        data: { user: sanitizeUser(user), accessToken },
    });
});

// Called automatically by the frontend Axios client whenever a request
// comes back 401 because the access token expired. The browser sends the
// refresh cookie automatically - the frontend never handles that token.
const refreshSession = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
        return res.status(401).json({ success: false, message: "No refresh token provided" });
    }

    const tokenHash = hashToken(refreshToken);
    const session = await Session.findOne({ tokenHash });

    if (!session || session.expiresAt < new Date()) {
        clearRefreshCookie(res);
        throw new ApiError(401, "Session expired, please log in again");
    }

    const user = await User.findById(session.userId);
    if (!user || user.isBanned) {
        clearRefreshCookie(res);
        throw new ApiError(401, "Session no longer valid");
    }

    const accessToken = generateAccessToken(user);
    res.status(200).json({
        success: true,
        data: { user: sanitizeUser(user), accessToken },
    });
});

const logoutUser = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
        await Session.deleteOne({ tokenHash: hashToken(refreshToken) });
    }
    clearRefreshCookie(res);
    res.status(200).json({ success: true, data: { message: "Logged out" } });
});

// Lets the frontend verify an existing in-memory access token is still
// valid right after app start, before deciding whether to refresh.
const authCheck = asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: { user: sanitizeUser(req.user) } });
});

const getUser = asyncHandler(async (req, res) => {
    if (req.params.id !== String(req.user._id) && !req.user.isAdmin) {
        throw new ApiError(403, "Not authorized to view this profile");
    }

    const user = await User.findById(req.params.id).select("-password");
    if (!user) throw new ApiError(404, "User not found");
    res.status(200).json({ success: true, data: { user } });
});

// Only these fields may ever be changed by a user updating their own
// profile - isAdmin / isBanned / warnings are managed elsewhere (admin
// actions) to prevent privilege escalation via this endpoint.
const EDITABLE_FIELDS = ["name", "phone", "address", "coordinates", "avatar", "bio"];

const updateUser = asyncHandler(async (req, res) => {
    if (req.params.id !== String(req.user._id) && !req.user.isAdmin) {
        throw new ApiError(403, "Not authorized to update this profile");
    }

    const updatedData = {};
    for (const field of EDITABLE_FIELDS) {
        if (req.body[field] !== undefined) updatedData[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.params.id, updatedData, { new: true }).select("-password");
    if (!user) throw new ApiError(404, "User not found");
    res.status(200).json({ success: true, data: { user } });
});

// A user may delete only their own account; admins may delete any account.
const deleteUser = asyncHandler(async (req, res) => {
    if (req.params.id !== String(req.user._id) && !req.user.isAdmin) {
        throw new ApiError(403, "Not authorized to delete this account");
    }
    await User.findByIdAndDelete(req.params.id);
    await Session.deleteMany({ userId: req.params.id });
    res.status(200).json({ success: true, data: { message: "Account deleted" } });
});

module.exports = {
    registerUser,
    loginUser,
    refreshSession,
    logoutUser,
    authCheck,
    getUser,
    updateUser,
    deleteUser,
};
