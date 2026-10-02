const Category = require("../../models/Category");
const { embedText, rankBySimilarity, cosineSimilarity } = require("./embeddingService");
const { completeJSON, isAIConfigured } = require("./providerClient");

// Confidence bands (spec #30). Configurable so they can be tuned with real
// usage data without a code change.
const HIGH_CONFIDENCE = Number(process.env.AI_HIGH_CONFIDENCE_THRESHOLD) || 0.82;
const LOW_CONFIDENCE = Number(process.env.AI_LOW_CONFIDENCE_THRESHOLD) || 0.62;

const confidenceBand = (score) => {
    if (score >= HIGH_CONFIDENCE) return "high";
    if (score >= LOW_CONFIDENCE) return "medium";
    return "low";
};

const normalizeForMatch = (value) => ` ${String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

const findCanonicalAliasMatch = (text, categories) => {
    const normalizedText = normalizeForMatch(text);
    const matches = categories.flatMap((category) => {
        const phrases = [category.name, ...(category.aliases || [])]
            .map((phrase) => String(phrase || "").trim())
            .filter((phrase) => phrase.length >= 3 && normalizedText.includes(normalizeForMatch(phrase)));
        return phrases.map((phrase) => ({ category, phrase }));
    });
    matches.sort((a, b) => b.phrase.length - a.phrase.length);
    const best = matches[0];
    if (!best) return null;

    return {
        categoryId: best.category._id,
        name: best.category.name,
        parentCategoryId: best.category.parentCategoryId || null,
        score: 0.94,
        confidence: confidenceBand(0.94),
        tags: [best.phrase],
    };
};

// The text a category's embedding is generated from. Keeping this in one
// place means re-embedding (e.g. after an alias is added) is consistent.
const categoryEmbeddingText = (cat) =>
    [cat.name, cat.description, ...(cat.aliases || [])].filter(Boolean).join(". ");

// (Re)computes and stores a category's embedding. Safe to call repeatedly;
// only writes if AI is configured, so seeding/admin flows never hard-fail
// when AI_API_KEY is absent (spec #35 applies here too).
const ensureCategoryEmbedding = async (categoryDoc) => {
    if (categoryDoc.embedding && categoryDoc.embedding.length > 0) return categoryDoc;
    if (!isAIConfigured()) return categoryDoc;
    let result;
    try {
        result = await embedText(categoryEmbeddingText(categoryDoc));
    } catch {
        return categoryDoc;
    }
    if (!result) return categoryDoc;
    categoryDoc.embedding = result.embedding;
    categoryDoc.embeddingModel = result.model;
    await categoryDoc.save();
    return categoryDoc;
};

// Core of spec #20/#21: given free-form text, retrieve EVERY category from
// MongoDB (never a hardcoded list), embed the text, and rank categories by
// cosine similarity. Returns the ranked list plus a recommendation.
//
// Throws AIUnavailableError if AI isn't configured/reachable - callers
// (the controller) must catch this and let the user pick manually.
const suggestCategoryForText = async (text, { limit = 5 } = {}) => {
    const categories = await Category.find()
        .select("name slug description aliases parentCategoryId embedding usageCount")
        .lean();

    const aliasMatch = findCanonicalAliasMatch(text, categories);
    if (aliasMatch) {
        return {
            matches: [aliasMatch],
            recommendation: aliasMatch,
            category: aliasMatch.name,
            confidence: aliasMatch.score,
            tags: aliasMatch.tags,
            noConfidentMatch: false,
        };
    }

    const embeddableCategories = categories.filter((category) => category.embedding?.length);
    let embedding;
    try {
        ({ embedding } = await embedText(text));
    } catch {
        return { matches: [], recommendation: null, tags: [], noConfidentMatch: true };
    }
    if (!embedding) {
        return { matches: [], recommendation: null, tags: [], noConfidentMatch: true };
    }

    const ranked = rankBySimilarity(embedding, embeddableCategories).slice(0, limit);
    const top = ranked[0] || null;
    let recommendation = top && top.score >= LOW_CONFIDENCE
        ? {
              categoryId: top._id,
              name: top.name,
              parentCategoryId: top.parentCategoryId || null,
              score: Math.round(top.score * 1000) / 1000,
              confidence: confidenceBand(top.score),
          }
        : null;
    let newCategorySuggestion = null;
    if (!recommendation) {
        const proposal = await suggestNewCanonicalCategory(text, categories);
        if (proposal?.duplicateRecommendation) recommendation = proposal.duplicateRecommendation;
        else newCategorySuggestion = proposal;
    }

    return {
        matches: recommendation ? [
            recommendation,
            ...ranked
                .filter((match) => String(match._id) !== String(recommendation.categoryId))
                .map((match) => ({
                    categoryId: match._id,
                    name: match.name,
                    parentCategoryId: match.parentCategoryId || null,
                    score: Math.round(match.score * 1000) / 1000,
                    confidence: confidenceBand(match.score),
                })),
        ].slice(0, limit) : [],
        recommendation,
        category: recommendation?.name || null,
        confidence: recommendation?.score ?? null,
        tags: [],
        newCategorySuggestion,
        noConfidentMatch: !recommendation && !newCategorySuggestion,
    };
};

const suggestNewCanonicalCategory = async (text, categories) => {
    try {
        const result = await completeJSON({
            system:
                "You maintain a controlled category list for a donation marketplace. " +
                "The item did not confidently match any existing category. Suggest one short, reusable canonical category name only if it is genuinely distinct from every listed category and alias. " +
                "Do not suggest a brand, model, item title, or a synonym of an existing category. " +
                'Return JSON only: {"name": string, "tags": string[]}.',
            prompt: `Item: "${text}"\nExisting canonical categories and aliases: ${JSON.stringify(categories.map(({ name, aliases = [], description }) => ({ name, aliases, description })))}`,
        });
        const name = typeof result?.name === "string" ? result.name.trim() : "";
        if (!name) return null;

        const aliasMatch = findCanonicalAliasMatch(name, categories);
        if (aliasMatch) return { duplicateRecommendation: aliasMatch };

        const slug = Category.slugify(name);
        const exactMatch = categories.find((category) => category.slug === slug);
        if (exactMatch) {
            return {
                duplicateRecommendation: {
                    categoryId: exactMatch._id,
                    name: exactMatch.name,
                    parentCategoryId: exactMatch.parentCategoryId || null,
                    score: 0.94,
                    confidence: confidenceBand(0.94),
                    tags: [],
                },
            };
        }

        if (categories.some((category) => !category.embedding?.length)) return null;

        const candidateEmbedding = await embedText(name);
        if (!candidateEmbedding?.embedding) return null;
        const similar = rankBySimilarity(
            candidateEmbedding.embedding,
            categories.filter((category) => category.embedding?.length)
        )[0];
        if (similar && similar.score >= 0.9) {
            return {
                duplicateRecommendation: {
                    categoryId: similar._id,
                    name: similar.name,
                    parentCategoryId: similar.parentCategoryId || null,
                    score: Math.round(similar.score * 1000) / 1000,
                    confidence: confidenceBand(similar.score),
                    tags: [],
                },
            };
        }

        return {
            name,
            tags: Array.isArray(result.tags)
                ? [...new Set(result.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))].slice(0, 10)
                : [],
        };
    } catch {
        return null;
    }
};

// Spec #22: before actually inserting a new category, check whether
// something semantically equivalent already exists (so "Baby Equipment",
// "Baby Gear", and "Baby items" collapse into one category instead of three).
// Returns the existing Category doc if a near-duplicate is found, else null.
const findNearDuplicateCategory = async (name, description = "") => {
    const slug = Category.slugify(name);
    const exactSlugMatch = await Category.findOne({ slug });
    if (exactSlugMatch) return exactSlugMatch;

    if (!isAIConfigured()) return null;

    const categories = await Category.find({ embedding: { $exists: true, $not: { $size: 0 } } })
        .select("name embedding")
        .lean();
    if (categories.length === 0) return null;

    let embedding;
    try {
        ({ embedding } = await embedText([name, description].filter(Boolean).join(". ")));
    } catch {
        return null;
    }
    if (!embedding) return null;

    const ranked = rankBySimilarity(embedding, categories);
    const top = ranked[0];
    // A stricter threshold than suggestion matching - this guards DB
    // writes, so we only treat it as a duplicate when very confident.
    if (top && top.score >= 0.9) {
        return Category.findById(top._id);
    }
    return null;
};

// Creates a category if (and only if) no near-duplicate exists; otherwise
// returns the existing one. This is the single write-path for new
// categories so the "don't blindly create hundreds of categories from
// every typo" rule (spec #22) is enforced in one place.
const getOrCreateCategory = async ({ name, description = "", aliases = [], parentCategoryId = null, createdBy = "user" }) => {
    const duplicate = await findNearDuplicateCategory(name, description);
    if (duplicate) return { category: duplicate, created: false };

    const category = await Category.create({
        name: name.trim(),
        description,
        aliases,
        parentCategoryId: parentCategoryId || null,
        createdBy,
    });
    await ensureCategoryEmbedding(category);
    return { category, created: true };
};

module.exports = {
    HIGH_CONFIDENCE,
    LOW_CONFIDENCE,
    confidenceBand,
    findCanonicalAliasMatch,
    categoryEmbeddingText,
    ensureCategoryEmbedding,
    suggestCategoryForText,
    findNearDuplicateCategory,
    getOrCreateCategory,
    cosineSimilarity,
};
