const Transaction = require("../models/Transaction");
const Request = require("../models/Request");
const Donation = require("../models/Donation");
const Item = require("../models/Item");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { ApiError, asyncHandler } = require("../utils/errorHandler");
const { distanceKm } = require("../utils/matching");

// Notifications are pure database records delivered over REST - Socket.IO
// is never involved here (see spec #22/#76: sockets are chat-only).
const notify = (userId, message, transactionId, type) =>
    Notification.create({ userId, message, transactionId, type });

// Recipient requests a donor's item -> creates a Transaction in "requested" state.
const createTransaction = asyncHandler(async (req, res) => {
    const { donorId, itemId, donationId } = req.body;
    const recipientId = req.user._id.toString(); // always the authenticated caller

    const donation = await Donation.findById(donationId);
    if (!donation) {
        throw new ApiError(400, "Invalid donation for this request");
    }
    const actualDonorId = donation.donorId.toString();
    const actualItemId = donation.itemId.toString();
    if ((donorId && donorId !== actualDonorId) || (itemId && itemId !== actualItemId)) {
        throw new ApiError(400, "Donation details do not match the selected item");
    }
    if (actualDonorId === recipientId) {
        throw new ApiError(400, "You cannot request your own donation");
    }
    if (donation.status !== "pending") {
        throw new ApiError(400, "This donation is no longer available");
    }

    const existing = await Transaction.findOne({
        itemId: actualItemId,
        recipientId,
        status: { $in: ["requested", "approved", "pickup_arranged"] },
    });
    if (existing) {
        throw new ApiError(400, "You already have an active request for this item");
    }

    const transaction = await Transaction.create({
        donorId: actualDonorId,
        recipientId,
        itemId: actualItemId,
        donationId,
        status: "requested",
    });

    await User.findByIdAndUpdate(actualDonorId, { $push: { transactions: transaction._id } });
    await User.findByIdAndUpdate(recipientId, { $push: { transactions: transaction._id } });

    const recipient = await User.findById(recipientId);
    await notify(actualDonorId, `${recipient?.name || "Someone"} wants your donated item.`, transaction._id, "transaction_request");

    res.status(201).json({ success: true, data: { transaction } });
});

// Donor offers to fulfil someone else's public request -> "offered" state,
// awaiting the requester's acceptance.
const offerHelp = asyncHandler(async (req, res) => {
    const { requestId, donationId } = req.body;
    const donorId = req.user._id.toString();

    const request = await Request.findById(requestId);
    if (!request) throw new ApiError(404, "Request not found");
    if (request.userId.toString() === donorId) {
        throw new ApiError(400, "You cannot offer help on your own request");
    }
    if (request.isCompleted) {
        throw new ApiError(400, "This request has already been fulfilled");
    }

    const donation = await Donation.findById(donationId).populate("itemId");
    if (!donation || donation.donorId.toString() !== donorId) {
        throw new ApiError(400, "Invalid donation");
    }
    if (donation.status !== "pending") {
        throw new ApiError(400, "This item is no longer available to offer");
    }

    const existing = await Transaction.findOne({
        requestId,
        donorId,
        status: { $in: ["offered", "approved", "pickup_arranged"] },
    });
    if (existing) {
        throw new ApiError(400, "You've already offered help on this request");
    }

    const transaction = await Transaction.create({
        donorId,
        recipientId: request.userId,
        itemId: donation.itemId._id,
        donationId: donation._id,
        requestId,
        status: "offered",
    });

    await User.findByIdAndUpdate(donorId, { $push: { transactions: transaction._id } });
    await User.findByIdAndUpdate(request.userId, { $push: { transactions: transaction._id } });

    const donor = await User.findById(donorId);
    await notify(
        request.userId,
        `${donor.name} offered to donate "${donation.itemId.name}" for your request.`,
        transaction._id,
        "transaction_request"
    );

    res.status(201).json({ success: true, data: { transaction } });
});

const getTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.transactionId)
        .populate("donorId", "name address coordinates")
        .populate("recipientId", "name address coordinates")
        .populate("itemId");

    if (!transaction) throw new ApiError(404, "Transaction not found");

    const isParty = [transaction.donorId._id.toString(), transaction.recipientId._id.toString()].includes(
        req.user._id.toString()
    );
    if (!isParty && !req.user.isAdmin) {
        throw new ApiError(403, "Not authorized to view this transaction");
    }

    const payload = transaction.toObject();
    payload.distanceKm = distanceKm(
        [transaction.donorId?.coordinates?.lng, transaction.donorId?.coordinates?.lat],
        [transaction.recipientId?.coordinates?.lng, transaction.recipientId?.coordinates?.lat]
    );

    res.status(200).json({ success: true, data: { transaction: payload } });
});

// The non-initiating side responds to a match: if "requested" (recipient
// asked first) the donor approves/rejects; if "offered" (donor offered
// first) the requester accepts/rejects.
//
// Prevents double booking (spec #40): approving one transaction for a
// donation atomically rejects every other still-active transaction for
// that same donation.
const respondToRequest = asyncHandler(async (req, res) => {
    const { response } = req.body; // "approved" | "rejected"
    if (!["approved", "rejected"].includes(response)) {
        throw new ApiError(400, "Invalid response");
    }

    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) throw new ApiError(404, "Transaction not found");
    if (!["requested", "offered"].includes(transaction.status)) {
        throw new ApiError(400, "This request has already been responded to");
    }

    const responderRole = transaction.status === "requested" ? "donorId" : "recipientId";
    if (transaction[responderRole].toString() !== req.user._id.toString()) {
        throw new ApiError(
            403,
            transaction.status === "requested"
                ? "Only the donor can respond to this request"
                : "Only the requester can respond to this offer"
        );
    }

    if (response === "approved") {
        // Atomically claim the donation: only succeeds if it's still pending,
        // which prevents two recipients from both being approved for it.
        const donation = await Donation.findOneAndUpdate(
            { _id: transaction.donationId, status: "pending" },
            { status: "matched" },
            { new: true }
        );
        if (!donation) {
            throw new ApiError(400, "This donation was already matched with someone else");
        }

        transaction.status = "approved";
        await transaction.save();

        await Item.findByIdAndUpdate(transaction.itemId, { status: "matched", recipientId: transaction.recipientId });

        // Reject every other still-active transaction for the same donation.
        const others = await Transaction.find({
            donationId: transaction.donationId,
            _id: { $ne: transaction._id },
            status: { $in: ["requested", "offered"] },
        });
        for (const other of others) {
            other.status = "rejected";
            await other.save();
            const otherPartyId = transaction.donorId.toString() === other.donorId.toString() ? other.recipientId : other.donorId;
            await notify(otherPartyId, "This donation has already been given to someone else.", other._id, "transaction_response");
        }
    } else {
        transaction.status = "rejected";
        await transaction.save();
    }

    const responder = await User.findById(req.user._id);
    const otherPartyId = responderRole === "donorId" ? transaction.recipientId : transaction.donorId;
    await notify(
        otherPartyId,
        response === "approved"
            ? `${responder.name} approved the match! You can now chat and arrange pickup.`
            : `${responder.name} wasn't able to go ahead with this match.`,
        transaction._id,
        "transaction_response"
    );

    res.status(200).json({ success: true, data: { transaction } });
});

const asIdString = (value) => (value && typeof value === "object" && value._id ? value._id.toString() : value?.toString?.() ?? "");

const roleOf = (transaction, userId) => {
    const uid = asIdString(userId);
    if (asIdString(transaction.donorId) === uid) return "donor";
    if (asIdString(transaction.recipientId) === uid) return "recipient";
    return null;
};

// The recipient proposes the initial self-pickup date/time. The donor may
// accept, decline, or counter-propose through respondToPickup.
const proposePickup = asyncHandler(async (req, res) => {
    const { scheduledDate, note } = req.body;

    const transaction = await Transaction.findById(req.params.transactionId).populate("donorId", "name address");
    if (!transaction) throw new ApiError(404, "Transaction not found");

    const role = roleOf(transaction, req.user._id);
    if (!role) throw new ApiError(403, "Not authorized");
    if (role !== "recipient") {
        throw new ApiError(403, "Only the recipient can propose the pickup date");
    }
    if (transaction.status !== "approved") {
        throw new ApiError(400, "This transaction is not ready for pickup coordination yet");
    }
    if (!scheduledDate) throw new ApiError(400, "Please choose a pickup date and time");

    transaction.pickupDetails = {
        method: "self",
        scheduledDate: new Date(scheduledDate),
        address: transaction.donorId?.address || "",
        note: note || "",
        status: "proposed",
        proposedBy: role,
    };
    await transaction.save();

    const proposer = await User.findById(req.user._id);
    const otherPartyId = role === "donor" ? transaction.recipientId : transaction.donorId._id;
    await notify(
        otherPartyId,
        `${proposer.name} proposed a pickup time: ${new Date(scheduledDate).toLocaleString()}.`,
        transaction._id,
        "pickup_proposal"
    );

    res.status(200).json({ success: true, data: { transaction } });
});

// The party who did NOT make the proposal accepts it, rejects it, or
// counter-proposes a different time in one step.
const respondToPickup = asyncHandler(async (req, res) => {
    const { response, scheduledDate, note } = req.body; // response: "accepted" | "rejected" | "counter"

    const transaction = await Transaction.findById(req.params.transactionId).populate("donorId", "name address");
    if (!transaction) throw new ApiError(404, "Transaction not found");

    const role = roleOf(transaction, req.user._id);
    if (!role) throw new ApiError(403, "Not authorized");
    if (!transaction.pickupDetails?.status || transaction.pickupDetails.status !== "proposed") {
        throw new ApiError(400, "There is no pending pickup proposal to respond to");
    }
    if (transaction.pickupDetails.proposedBy === role) {
        throw new ApiError(400, "You proposed this time - waiting on the other party to respond");
    }

    const responder = await User.findById(req.user._id);
    const otherPartyId = role === "donor" ? transaction.recipientId : transaction.donorId._id;

    if (response === "accepted") {
        transaction.pickupDetails.status = "confirmed";
        transaction.status = "pickup_arranged";
        await transaction.save();
        await notify(
            otherPartyId,
            `${responder.name} confirmed the pickup for ${new Date(transaction.pickupDetails.scheduledDate).toLocaleString()}.`,
            transaction._id,
            "pickup_confirmed"
        );
    } else if (response === "rejected") {
        transaction.pickupDetails = { scheduledDate: null, address: "", note: "" };
        await transaction.save();
        await notify(otherPartyId, `${responder.name} couldn't make that pickup time. Please propose another.`, transaction._id, "pickup_response");
    } else if (response === "counter") {
        if (!scheduledDate) throw new ApiError(400, "Please choose an alternative date and time");
        transaction.pickupDetails = {
            method: "self",
            scheduledDate: new Date(scheduledDate),
            address: transaction.donorId?.address || "",
            note: note || "",
            status: "proposed",
            proposedBy: role,
        };
        await transaction.save();
        await notify(
            otherPartyId,
            `${responder.name} proposed a different pickup time: ${new Date(scheduledDate).toLocaleString()}.`,
            transaction._id,
            "pickup_proposal"
        );
    } else {
        throw new ApiError(400, "Invalid response - must be accepted, rejected, or counter");
    }

    res.status(200).json({ success: true, data: { transaction } });
});

// Recipient confirms the item has been received -> transaction completed.
// Idempotent: calling this twice never double-counts (spec #44).
const completeTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) throw new ApiError(404, "Transaction not found");
    if (transaction.recipientId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Only the recipient can mark the item as received");
    }

    if (transaction.status === "completed") {
        // Already completed - return success without doing any of the side
        // effects again (no double-counting, no duplicate item updates).
        return res.status(200).json({ success: true, data: { transaction } });
    }

    if (transaction.status !== "pickup_arranged") {
        throw new ApiError(400, "Pickup has not been arranged yet");
    }

    // Atomic guard: only the first call flips this from pickup_arranged to
    // completed; a concurrent duplicate call will find no matching document.
    const updated = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: "pickup_arranged" },
        { status: "completed", completedAt: new Date() },
        { new: true }
    );
    if (!updated) {
        const current = await Transaction.findById(transaction._id);
        return res.status(200).json({ success: true, data: { transaction: current } });
    }

    await Item.findByIdAndUpdate(updated.itemId, { status: "donated" });
    await Donation.findByIdAndUpdate(updated.donationId, { status: "completed" });

    if (updated.requestId) {
        const request = await Request.findById(updated.requestId);
        if (request) {
            request.fulfilledQuantity += updated.quantity || 1;
            if (request.fulfilledQuantity >= request.quantity) request.isCompleted = true;
            await request.save();
        }
    }

    await notify(
        updated.donorId,
        "The recipient confirmed they received your item. Thank you for donating!",
        updated._id,
        "transaction_completed"
    );

    res.status(200).json({ success: true, data: { transaction: updated } });
});

const cancelTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) throw new ApiError(404, "Transaction not found");

    const isParty = [transaction.donorId.toString(), transaction.recipientId.toString()].includes(
        req.user._id.toString()
    );
    if (!isParty) throw new ApiError(403, "Not authorized");
    if (transaction.status === "completed") {
        throw new ApiError(400, "Cannot cancel a completed transaction");
    }

    const wasMatched = ["approved", "pickup_arranged"].includes(transaction.status);

    transaction.status = "cancelled";
    await transaction.save();

    if (wasMatched) {
        await Item.findByIdAndUpdate(transaction.itemId, { status: "available", recipientId: null });
        await Donation.findByIdAndUpdate(transaction.donationId, { status: "pending" });
    }

    res.status(200).json({ success: true, data: { transaction } });
});

const getUserTransactions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const transactions = await Transaction.find({ $or: [{ donorId: userId }, { recipientId: userId }] })
        .sort({ createdAt: -1 })
        .populate("donationId")
        .populate("requestId")
        .populate("itemId")
        .populate("donorId", "name")
        .populate("recipientId", "name");

    res.status(200).json({ success: true, data: { transactions } });
});

// Requests awaiting the current user's (as donor) approval.
const getPendingApprovals = asyncHandler(async (req, res) => {
    const requested = await Transaction.find({ donorId: req.user._id, status: "requested" })
        .sort({ createdAt: -1 })
        .populate("itemId")
        .populate("recipientId", "name address");

    // Offers awaiting the current user's (as requester) acceptance.
    const offered = await Transaction.find({ recipientId: req.user._id, status: "offered" })
        .sort({ createdAt: -1 })
        .populate("itemId")
        .populate("donorId", "name address");

    res.status(200).json({ success: true, data: { incomingRequests: requested, incomingOffers: offered } });
});

module.exports = {
    createTransaction,
    offerHelp,
    getTransaction,
    respondToRequest,
    proposePickup,
    respondToPickup,
    completeTransaction,
    cancelTransaction,
    getUserTransactions,
    getPendingApprovals,
};
