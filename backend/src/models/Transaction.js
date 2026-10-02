const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", required: true },
    // Optional: only set when the transaction originated from someone's
    // public request rather than a direct donation request.
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },

    // requested       -> recipient asked for a specific donation, awaiting donor's approval
    // offered         -> donor offered to fulfil a public request, awaiting requester's acceptance
    // approved        -> match confirmed, chat unlocked; pickupDetails may hold a
    //                    proposed (not yet confirmed) time while still in this status
    // pickup_arranged -> both sides confirmed a specific pickup time
    // completed       -> item has been handed over
    // rejected        -> the other side declined
    // cancelled       -> either side cancelled
    status: {
        type: String,
        enum: ["requested", "offered", "approved", "pickup_arranged", "completed", "rejected", "cancelled"],
        default: "requested",
    },

    quantity: { type: Number, default: 1, min: 1 },

    pickupDetails: {
        method: { type: String, enum: ["self"], default: undefined },
        scheduledDate: { type: Date, default: null },
        address: { type: String, default: "" },
        note: { type: String, default: "" },
        // "proposed" -> awaiting the other party's response
        // "confirmed" -> both sides agreed; this is when a physical pickup can happen
        status: { type: String, enum: ["proposed", "confirmed"], default: undefined },
        // Who most recently proposed this time - the OTHER party is the one
        // who must accept/reject/counter-propose it.
        proposedBy: { type: String, enum: ["donor", "recipient"], default: undefined },
    },

    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
});

TransactionSchema.index({ donorId: 1 });
TransactionSchema.index({ recipientId: 1 });
TransactionSchema.index({ donationId: 1 });
TransactionSchema.index({ requestId: 1 });
TransactionSchema.index({ status: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
