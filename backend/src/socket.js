const { verifyAccessToken } = require("./utils/tokens");
const Transaction = require("./models/Transaction");

let ioInstance = null;

const setSocketIO = (io) => {
    ioInstance = io;
};

const getSocketIO = () => ioInstance;

// Chat is only unlocked once a transaction has moved past the request/offer
// stage (see CHAT_ELIGIBLE_STATUSES) - kept in one place so the frontend
// and the socket layer can agree on the exact same rule.
const CHAT_ELIGIBLE_STATUSES = ["approved", "pickup_arranged", "completed"];

const transactionRoom = (transactionId) => `transaction:${transactionId}`;

// Socket.IO's ONLY responsibility in this app is real-time delivery of
// donor <-> recipient chat messages. Notifications, matching, the
// homepage counter, and auth all go through plain REST endpoints.
const initSocket = (io) => {
    // Authenticate the socket itself using the same short-lived access
    // token used for REST calls - never trust a client-supplied user id.
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Not authorized"));
            const decoded = verifyAccessToken(token);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error("Not authorized"));
        }
    });

    io.on("connection", (socket) => {
        socket.on("joinTransaction", async (transactionId, callback) => {
            try {
                const transaction = await Transaction.findById(transactionId);
                if (!transaction) {
                    return callback?.({ success: false, message: "Transaction not found" });
                }

                const userId = socket.userId;
                const isParticipant =
                    transaction.donorId.toString() === userId ||
                    transaction.recipientId.toString() === userId;

                if (!isParticipant) {
                    return callback?.({ success: false, message: "Not authorized for this transaction" });
                }

                if (!CHAT_ELIGIBLE_STATUSES.includes(transaction.status)) {
                    return callback?.({ success: false, message: "Chat is not available yet" });
                }

                socket.join(transactionRoom(transactionId));
                callback?.({ success: true });
            } catch (err) {
                callback?.({ success: false, message: "Unable to join chat" });
            }
        });

        socket.on("leaveTransaction", (transactionId) => {
            socket.leave(transactionRoom(transactionId));
        });

        socket.on("disconnect", () => {
            // No-op: rooms are cleaned up automatically by Socket.IO.
        });
    });
};

// Called by the message controller after a message is persisted via REST,
// to push it in real time to the other participant.
const emitNewMessage = (transactionId, message) => {
    getSocketIO()?.to(transactionRoom(transactionId)).emit("newMessage", message);
};

module.exports = {
    setSocketIO,
    getSocketIO,
    initSocket,
    emitNewMessage,
    CHAT_ELIGIBLE_STATUSES,
    transactionRoom,
};
