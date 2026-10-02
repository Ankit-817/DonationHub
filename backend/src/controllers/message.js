const Message = require("../models/Message");
const Transaction = require("../models/Transaction");
const { ApiError, asyncHandler } = require("../utils/errorHandler");
const { emitNewMessage, CHAT_ELIGIBLE_STATUSES } = require("../socket");

const getMessagesByTransaction = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new ApiError(404, "Transaction not found");

    const isParty = [transaction.donorId.toString(), transaction.recipientId.toString()].includes(
        req.user._id.toString()
    );
    if (!isParty) throw new ApiError(403, "Not authorized to view this conversation");

    const messages = await Message.find({ transaction: transactionId })
        .sort({ timestamp: 1 })
        .populate("sender", "name _id");

    res.status(200).json({ success: true, data: { messages } });
});

// REST is the source of truth for message persistence. After saving, the
// message is returned directly to the sender (fixing the old bug where the
// sender's UI depended on receiving its own Socket.IO echo); Socket.IO is
// only used to push the message to the other participant in real time.
const sendMessage = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const { content } = req.body;
    const senderId = req.user._id;

    if (!content || !content.trim()) {
        throw new ApiError(400, "Message cannot be empty");
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new ApiError(404, "Transaction not found");

    const isParty = [transaction.donorId.toString(), transaction.recipientId.toString()].includes(
        senderId.toString()
    );
    if (!isParty) throw new ApiError(403, "Not authorized to message on this transaction");

    if (!CHAT_ELIGIBLE_STATUSES.includes(transaction.status)) {
        throw new ApiError(400, "Chat unlocks once the donor approves the request");
    }

    const receiverId =
        transaction.recipientId.toString() === senderId.toString() ? transaction.donorId : transaction.recipientId;

    let newMessage = await Message.create({
        transaction: transactionId,
        sender: senderId,
        receiver: receiverId,
        content: content.trim(),
    });
    newMessage = await newMessage.populate("sender", "name _id");

    // Only the receiver needs a real-time push; the sender already has the
    // message from this response, so chat still works even if their own
    // socket is disconnected.
    emitNewMessage(transactionId, newMessage);

    res.status(201).json({ success: true, data: { message: newMessage } });
});

const markMessagesAsRead = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const updated = await Message.updateMany(
        { transaction: transactionId, receiver: req.user._id, read: false },
        { $set: { read: true } }
    );
    res.status(200).json({ success: true, data: { updatedCount: updated.modifiedCount } });
});

module.exports = { getMessagesByTransaction, sendMessage, markMessagesAsRead };
