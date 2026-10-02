const mongoose = require("mongoose");

// One document per active refresh token ("session"/device). Storing only
// a hash of the token means a leaked database can't be used to forge
// sessions, and lets us support logout / revocation / multi-device later
// without redesigning anything.
const SessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});

SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", SessionSchema);
