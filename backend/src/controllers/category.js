const Category = require("../models/Category");
const { ApiError, asyncHandler } = require("../utils/errorHandler");
const { suggestCategoryForText, getOrCreateCategory } = require("../services/ai/categoryService");
const { classifyFromTextAndImage } = require("../services/ai/imageClassificationService");
const { AIUnavailableError, isAIConfigured } = require("../services/ai/providerClient");

// Public: the frontend always loads the category list from here, never
// from a bundled constant (spec #18). Small enough to return in full and
// let the client render it as flat options or a parent/child tree.
const listCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find()
        .select("name slug description parentCategoryId usageCount")
        .sort({ usageCount: -1, name: 1 })
        .lean();
    res.status(200).json({ success: true, data: { categories } });
});

// Spec #20/#28/#29: given free text and/or an image URL, return ranked
// existing-category matches plus a new-category suggestion if nothing
// fits well. Never 500s because AI is down - instead reports
// aiAvailable:false so the frontend can fall back to manual selection
// (spec #35: "AI suggestions are temporarily unavailable...").
const suggestCategory = asyncHandler(async (req, res) => {
    const { text, imageUrl } = req.body;
    if (!text && !imageUrl) {
        throw new ApiError(400, "Provide item text, an image, or both");
    }
    if (!isAIConfigured()) {
        return res.status(200).json({
            success: true,
            data: { aiAvailable: false, matches: [], recommendation: null, tags: [], noConfidentMatch: false },
        });
    }

    try {
        const result = imageUrl
            ? await classifyFromTextAndImage({ text, imageUrl })
            : await suggestCategoryForText(text);

        const { _queryEmbedding, ...safeResult } = result; // never leak raw vectors to the client
        res.status(200).json({ success: true, data: { aiAvailable: true, ...safeResult } });
    } catch (err) {
        if (err instanceof AIUnavailableError) {
            return res.status(200).json({
                success: true,
                data: { aiAvailable: false, matches: [], recommendation: null, tags: [], noConfidentMatch: false },
            });
        }
        throw err;
    }
});

// Creates a category, or returns the existing near-duplicate instead of
// creating one (spec #22). Any authenticated user can call this (it's how
// "Create category" in the donation/request form works), but duplicates
// are always collapsed so this can't be used to spam the taxonomy.
const createCategory = asyncHandler(async (req, res) => {
    const { name, description, aliases, parentCategoryId } = req.body;
    if (!name || !name.trim()) throw new ApiError(400, "Category name is required");

    const { category, created } = await getOrCreateCategory({
        name,
        description,
        aliases: Array.isArray(aliases) ? aliases : [],
        parentCategoryId: parentCategoryId || null,
        createdBy: "user",
    });

    res.status(created ? 201 : 200).json({ success: true, data: { category, created } });
});

module.exports = { listCategories, suggestCategory, createCategory };
