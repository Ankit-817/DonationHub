const mongoose = require("mongoose");
const Donation = require("../models/Donation");
const Item = require("../models/Item");
const User = require("../models/User");
const Category = require("../models/Category");
const { ApiError, asyncHandler } = require("../utils/errorHandler");
const { sanitizeText, isValidQuantity, MAX_TEXT_LENGTH } = require("../middlewares/validate");
const { embedText } = require("../services/ai/embeddingService");

const VALID_CONDITIONS = ["new", "like_new", "used", "any"];
const VALID_CATEGORY_SOURCES = ["ai", "user", "manual_fallback"];

// Donations are never forced into a fixed dropdown (spec #19): the client
// always resolves a categoryId first (by accepting an AI suggestion,
// picking from the dynamic list, or creating a new category), and that id
// - not a free-typed string - is what's trusted here.
const createDonation = asyncHandler(async (req, res) => {
    const { name, categoryId, description, quantity, condition, categorySource, categoryConfidence } = req.body;

    if (!name || !categoryId || !quantity || !condition) {
        throw new ApiError(400, "Missing required fields");
    }
    if (!VALID_CONDITIONS.includes(condition) || condition === "any") {
        throw new ApiError(400, "Invalid condition value");
    }
    if (!isValidQuantity(quantity)) {
        throw new ApiError(400, "Quantity must be a number between 1 and 10000");
    }

    const category = await Category.findById(categoryId);
    if (!category) throw new ApiError(400, "Invalid category");

    const cleanName = sanitizeText(name, MAX_TEXT_LENGTH.short);
    const cleanDescription = sanitizeText(description, MAX_TEXT_LENGTH.long);
    const imageUrls = req.files?.map((file) => file.path) || [];

    const donor = req.user;
    const { lat, lng } = donor.coordinates;

    // AI is an enhancement, never a dependency (spec #35): if embedding
    // generation fails (no API key, provider down, timeout), the donation
    // is still created without one - it just participates less precisely
    // in semantic matching until it's possible to retry.
    let embedding;
    let embeddingModel = "";
    try {
        const result = await embedText([cleanName, cleanDescription].filter(Boolean).join(". "));
        if (result) {
            embedding = result.embedding;
            embeddingModel = result.model;
        }
    } catch {
        // swallow - embedding stays undefined, matchingService handles that
    }

    const item = await Item.create({
        name: cleanName,
        category: category.name,
        categoryId: category._id,
        categorySource: VALID_CATEGORY_SOURCES.includes(categorySource) ? categorySource : "user",
        categoryConfidence: typeof categoryConfidence === "number" ? categoryConfidence : null,
        description: cleanDescription,
        quantity,
        imageUrl: imageUrls,
        condition,
        embedding,
        embeddingModel,
        donorId: donor._id,
        status: "available",
    });

    Category.updateOne({ _id: category._id }, { $inc: { usageCount: 1 } }).catch(() => {});

    const donation = await Donation.create({
        donorId: donor._id,
        itemId: item._id,
        coordinates: { type: "Point", coordinates: [lng, lat] },
        status: "pending",
    });

    item.donationId = donation._id;
    await item.save();

    await User.findByIdAndUpdate(donor._id, { $push: { donations: donation._id } });

    res.status(201).json({ success: true, data: { donation } });
});

const getDonation = asyncHandler(async (req, res) => {
    const donation = await Donation.findById(req.params.id)
        .select("-coordinates")
        .populate("itemId")
        .populate({ path: "donorId", select: "name" });

    if (!donation) throw new ApiError(404, "Donation not found");
    res.status(200).json({ success: true, data: { donation } });
});

// Public browse listing - only ever shows donations that are actually
// still available (never completed/cancelled ones, per spec #38).
const getDonations = asyncHandler(async (req, res) => {
    const { category, condition, search, sort = "recent", page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const donationMatch = { status: "pending" };
    if (req.user) donationMatch.donorId = { $ne: req.user._id };

    const { categoryId } = req.query;
    const itemMatch = { "item.status": "available" };
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) itemMatch["item.categoryId"] = new mongoose.Types.ObjectId(categoryId);
    else if (category) itemMatch["item.category"] = category;
    if (condition) itemMatch["item.condition"] = condition;
    if (search) {
        itemMatch.$or = [
            { "item.name": { $regex: search, $options: "i" } },
            { "item.description": { $regex: search, $options: "i" } },
        ];
    }

    const sortOption =
        {
            recent: { createdAt: -1 },
            oldest: { createdAt: 1 },
            name_asc: { "item.name": 1 },
            name_desc: { "item.name": -1 },
        }[sort] || { createdAt: -1 };

    const pipeline = [
        { $match: donationMatch },
        { $lookup: { from: "items", localField: "itemId", foreignField: "_id", as: "item" } },
        { $unwind: "$item" },
        { $match: itemMatch },
    ];

    const donations = await Donation.aggregate([
        ...pipeline,
        { $sort: sortOption },
        { $skip: skip },
        { $limit: parseInt(limit) },
        { $project: { coordinates: 0 } },
    ]);

    const totalResults = await Donation.aggregate([...pipeline, { $count: "total" }]);
    const total = totalResults[0]?.total || 0;

    res.status(200).json({
        success: true,
        data: {
            donations,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)) || 1,
        },
    });
});

const getUserDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find({ donorId: req.user._id })
        .populate("itemId")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: { donations } });
});

module.exports = { createDonation, getDonations, getDonation, getUserDonations };
