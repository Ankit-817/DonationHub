const mongoose = require("mongoose");

const DonationSchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    status: {
        type: String,
        enum: ["pending", "matched", "completed", "cancelled"],
        default: "pending",
    },
    coordinates: {
        type: {
            type: String,
            enum: ["Point"],
            required: true,
        },
        coordinates: {
            type: [Number], // GeoJSON: [lng, lat]
            required: true,
        },
    },
    createdAt: { type: Date, default: Date.now },
});

DonationSchema.index({ coordinates: "2dsphere" });
DonationSchema.index({ donorId: 1 });
DonationSchema.index({ status: 1 });

module.exports = mongoose.model("Donation", DonationSchema);
