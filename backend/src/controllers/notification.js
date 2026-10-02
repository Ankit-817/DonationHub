const Notification = require("../models/Notification");
const { ApiError, asyncHandler } = require("../utils/errorHandler");

// Notifications are never created directly by a client request - only by
// trusted backend operations (transaction/pickup/completion flows). This
// closes the old security hole where a user could POST a notification
// for an arbitrary userId.

const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { notifications } });
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.notificationId);
    if (!notification) throw new ApiError(404, "Notification not found");
    if (notification.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to modify this notification");
    }

    notification.status = "read";
    await notification.save();
    res.status(200).json({ success: true, data: { notification } });
});

const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.notificationId);
    if (!notification) throw new ApiError(404, "Notification not found");
    if (notification.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to delete this notification");
    }

    await notification.deleteOne();
    res.status(200).json({ success: true, data: { message: "Notification deleted" } });
});

module.exports = { getNotifications, markNotificationAsRead, deleteNotification };
