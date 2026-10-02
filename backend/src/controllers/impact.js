const Transaction = require("../models/Transaction");
const { asyncHandler } = require("../utils/errorHandler");

// Successful donations = count(Transaction where status = "completed").
// This is the single source of truth for the homepage counter - it is
// never derived from Donation/Item documents, which can exist without a
// donation ever actually completing.
const getImpactStats = asyncHandler(async (req, res) => {
    const successfulDonations = await Transaction.countDocuments({ status: "completed" });

    const peopleHelped = (
        await Transaction.distinct("recipientId", { status: "completed" })
    ).length;

    res.status(200).json({
        success: true,
        data: { successfulDonations, peopleHelped },
    });
});

module.exports = { getImpactStats };
