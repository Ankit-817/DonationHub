const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: {
        type: String,
        unique: true,
        required: true,
        match: [/\S+@\S+\.\S+/, "Please enter a valid email address"],
    },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },

    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    warnings: { type: Number, default: 0 },

    donations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Donation" }],
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Request" }],
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],

    joinedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
