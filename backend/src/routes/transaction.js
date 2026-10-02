const express = require("express");
const router = express.Router();
const {
    createTransaction,
    offerHelp,
    respondToRequest,
    proposePickup,
    respondToPickup,
    completeTransaction,
    getTransaction,
    cancelTransaction,
    getUserTransactions,
    getPendingApprovals,
} = require("../controllers/transaction");
const { authMiddleware } = require("../middlewares/auth");
const { isObjectId } = require("../middlewares/validate");

router.use(authMiddleware);

router.get("/mine", getUserTransactions);
router.get("/approvals", getPendingApprovals);
router.post("/", createTransaction);
router.post("/offer", offerHelp);
router.get("/:transactionId", isObjectId("transactionId"), getTransaction);
router.post("/:transactionId/respond", isObjectId("transactionId"), respondToRequest);
router.post("/:transactionId/pickup", isObjectId("transactionId"), proposePickup);
router.post("/:transactionId/pickup/respond", isObjectId("transactionId"), respondToPickup);
router.post("/:transactionId/complete", isObjectId("transactionId"), completeTransaction);
router.post("/:transactionId/cancel", isObjectId("transactionId"), cancelTransaction);

module.exports = router;
