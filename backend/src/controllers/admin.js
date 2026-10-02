const User = require("../models/User");
const Donation = require("../models/Donation");
const Request = require("../models/Request");
const Transaction = require("../models/Transaction");
const { ApiError, asyncHandler } = require("../utils/errorHandler");

const getDashboardStats = asyncHandler(async (req, res) => {
    const [totalUsers, totalDonations, totalRequests, completedTransactions, bannedUsers] = await Promise.all([
        User.countDocuments(),
        Donation.countDocuments(),
        Request.countDocuments(),
        Transaction.countDocuments({ status: "completed" }),
        User.countDocuments({ isBanned: true }),
    ]);

    res.status(200).json({
        success: true,
        data: { totalUsers, totalDonations, totalRequests, completedTransactions, bannedUsers },
    });
});

const listUsersAdmin = asyncHandler(async (req, res) => {
    const { search } = req.query;
    const filter = {};
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }
    const users = await User.find(filter).select("-password").sort({ joinedAt: -1 }).limit(200);
    res.status(200).json({ success: true, data: { users } });
});

const setUserBanStatus = asyncHandler(async (req, res) => {
    const { isBanned, banReason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "User not found");
    if (user.isAdmin) throw new ApiError(400, "Cannot ban an admin");

    user.isBanned = !!isBanned;
    user.banReason = isBanned ? banReason || "Violation of community guidelines" : "";
    await user.save();

    res.status(200).json({ success: true, data: { user } });
});

const listDonationsAdmin = asyncHandler(async (req, res) => {
    const donations = await Donation.find().populate("itemId").populate("donorId", "name email").sort({ createdAt: -1 }).limit(200);
    res.status(200).json({ success: true, data: { donations } });
});

module.exports = { getDashboardStats, listUsersAdmin, setUserBanStatus, listDonationsAdmin };
