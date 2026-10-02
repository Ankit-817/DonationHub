const Request = require("../models/Request");
const Donation = require("../models/Donation");
const User = require("../models/User");
const Category = require("../models/Category");
const { ApiError, asyncHandler } = require("../utils/errorHandler");
const { DEFAULT_MATCH_DISTANCE_KM } = require("../utils/matching");
const { sanitizeText, isValidQuantity, MAX_TEXT_LENGTH } = require("../middlewares/validate");
const { embedText } = require("../services/ai/embeddingService");
const { rankCandidates } = require("../services/ai/matchingService");

const VALID_CATEGORY_SOURCES = ["ai", "user", "manual_fallback"];

// Same dynamic-category architecture as donations (spec #39): the client
// resolves a categoryId before submitting, so a request is never forced
// into a hardcoded dropdown either.
const createRequest = asyncHandler(async (req, res) => {
    const { categoryId, description, quantity, condition, urgency, categorySource, categoryConfidence } = req.body;

    if (!categoryId || !quantity) {
        throw new ApiError(400, "Missing required fields");
    }
    if (!isValidQuantity(quantity)) {
        throw new ApiError(400, "Quantity must be a number between 1 and 10000");
    }

    const category = await Category.findById(categoryId);
    if (!category) throw new ApiError(400, "Invalid category");

    const cleanDescription = sanitizeText(description, MAX_TEXT_LENGTH.long);
    const user = req.user;
    const { lat, lng } = user.coordinates;

    let embedding;
    let embeddingModel = "";
    try {
        const result = await embedText([category.name, cleanDescription].filter(Boolean).join(". "));
        if (result) {
            embedding = result.embedding;
            embeddingModel = result.model;
        }
    } catch {
        // AI down - request is still created, matching degrades gracefully
    }

    const request = await Request.create({
        userId: user._id,
        itemType: category.name,
        categoryId: category._id,
        categorySource: VALID_CATEGORY_SOURCES.includes(categorySource) ? categorySource : "user",
        categoryConfidence: typeof categoryConfidence === "number" ? categoryConfidence : null,
        description: cleanDescription,
        quantity,
        condition,
        urgency,
        embedding,
        embeddingModel,
        coordinates: { type: "Point", coordinates: [lng, lat] },
    });

    Category.updateOne({ _id: category._id }, { $inc: { usageCount: 1 } }).catch(() => {});
    await User.findByIdAndUpdate(user._id, { $push: { requests: request._id } });

    res.status(201).json({ success: true, data: { request } });
});

// Public browse listing - only ever shows requests that still need help.
const getRequests = asyncHandler(async (req, res) => {
    const filter = { isCompleted: false };
    if (req.user?._id) filter.userId = { $ne: req.user._id };

    const requests = await Request.find(filter)
        .select("-coordinates")
        .sort({ createdAt: -1 })
        .populate("userId", "name");

    res.status(200).json({ success: true, data: { requests } });
});

// Spec #25-27: semantic donation<->request matching. Candidates are first
// narrowed down with a cheap DB query (available items within a generous
// radius), then ranked in application code by services/ai/matchingService,
// which blends embedding similarity with category/location/condition/
// recency - not category-equality alone. If embeddings are missing on
// either side (AI was unavailable), the weighting redistributes itself
// automatically, so this endpoint never depends on AI being up.
const getMatchingDonations = asyncHandler(async (req, res) => {
    const { maxDistance = DEFAULT_MATCH_DISTANCE_KM, page = 1, limit = 10 } = req.query;
    const maxDistanceKm = parseFloat(maxDistance);

    const request = await Request.findById(req.params.id);
    if (!request) throw new ApiError(404, "Request not found");
    if (request.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        throw new ApiError(403, "Not authorized to view matches for this request");
    }

    // Cast a slightly wider net than a strict category filter would: any
    // available item is a semantic candidate, but we still cheaply exclude
    // anything geographically impossible before scoring, to keep the
    // in-process ranking step bounded in size.
    const donations = await Donation.find({
        status: "pending",
        coordinates: {
            $geoWithin: { $centerSphere: [request.coordinates.coordinates, maxDistanceKm / 6378.1] },
        },
    })
        .populate({ path: "itemId", match: { status: "available" } })
        .populate("donorId", "name address coordinates")
        .lean();

    const candidates = donations.filter((d) => d.itemId).map((d) => ({ donation: d, item: d.itemId }));

    const ranked = rankCandidates(request, candidates, { maxDistanceKm });

    const total = ranked.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const pageItems = ranked.slice(start, start + parseInt(limit));

    res.status(200).json({
        success: true,
        data: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            matches: pageItems.map((m) => ({
                donation: {
                    ...m.donation,
                    coordinates: undefined,
                    donorId: m.donation.donorId
                        ? { _id: m.donation.donorId._id, name: m.donation.donorId.name }
                        : null,
                },
                distanceKm: m.distanceKm != null ? Math.round(m.distanceKm * 10) / 10 : null,
                matchScore: m.score,
            })),
        },
    });
});

const getUserRequests = asyncHandler(async (req, res) => {
    const requests = await Request.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { requests, total: requests.length } });
});

module.exports = { createRequest, getRequests, getMatchingDonations, getUserRequests };
