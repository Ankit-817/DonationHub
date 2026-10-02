const mongoose = require("mongoose");

// Shared vocabulary used by both donations and requests so matching logic
// doesn't have to translate between two different sets of values.
const CONDITIONS = ["new", "like_new", "used", "any"];

const ItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    // Denormalized category NAME for fast display/filtering without a
    // populate. The source of truth is categoryId -> Category (spec #18);
    // this field is kept in sync whenever categoryId is set.
    category: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    // Did the user accept an AI suggestion, pick manually, or was AI
    // unavailable (spec #36)?
    categorySource: { type: String, enum: ["ai", "user", "manual_fallback"], default: "user" },
    categoryConfidence: { type: Number, default: null },
    description: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: [{ type: String }],
    condition: {
        type: String,
        enum: CONDITIONS,
        default: "used",
    },

    // Embedding of `name + description`, used by services/ai/matchingService
    // for semantic donation<->request matching (spec #25). Left undefined
    // when AI was unavailable at creation time - matching degrades
    // gracefully in that case (see matchingService.scorePair).
    embedding: { type: [Number], default: undefined },
    embeddingModel: { type: String, default: "" },

    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", default: null },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },

    status: { type: String, enum: ["available", "matched", "donated"], default: "available" },

    createdAt: { type: Date, default: Date.now },
});

ItemSchema.index({ category: 1, status: 1 });
ItemSchema.index({ categoryId: 1, status: 1 });

module.exports = mongoose.model("Item", ItemSchema);
module.exports.CONDITIONS = CONDITIONS;
