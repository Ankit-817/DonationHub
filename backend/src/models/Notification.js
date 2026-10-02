const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    type: {
        type: String,
        enum: [
            "transaction_request",
            "transaction_response",
            "pickup_proposal",
            "pickup_confirmed",
            "pickup_response",
            "transaction_completed",
            "category_feedback",
        ],
        required: true,
    },
    status: { type: String, enum: ["unread", "read"], default: "unread" },
    createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
