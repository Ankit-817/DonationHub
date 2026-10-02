const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
});

MessageSchema.index({ transaction: 1, timestamp: 1 });

module.exports = mongoose.model("Message", MessageSchema);
