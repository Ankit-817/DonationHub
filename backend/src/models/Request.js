const mongoose = require("mongoose");

const RequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Denormalized category NAME, kept for backward-compatible display and
    // as the matching fallback when categoryId/embedding aren't available.
    itemType: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    categorySource: { type: String, enum: ["ai", "user", "manual_fallback"], default: "user" },
    categoryConfidence: { type: Number, default: null },
    description: { type: String, default: "" },
    // Embedding of `itemType + description`, used for semantic matching
    // against donation items (spec #25-27). May be absent if AI was down.
    embedding: { type: [Number], default: undefined },
    embeddingModel: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    fulfilledQuantity: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    condition: { type: String, enum: ["new", "like_new", "used", "any"], default: "any" },
    urgency: { type: String, enum: ["low", "medium", "high"], default: "medium" },
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

RequestSchema.index({ coordinates: "2dsphere" });
RequestSchema.index({ userId: 1 });
RequestSchema.index({ isCompleted: 1 });
RequestSchema.index({ categoryId: 1, isCompleted: 1 });

module.exports = mongoose.model("Request", RequestSchema);
