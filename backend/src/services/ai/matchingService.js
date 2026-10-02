const { cosineSimilarity } = require("./embeddingService");
const { distanceKm, isConditionCompatible, DEFAULT_MATCH_DISTANCE_KM } = require("../../utils/matching");

// Documented ranking weights (spec #27 explicitly asks that weights not be
// arbitrary/unexplained). These sum to 1.0 across the signals that are
// present; if an item has no embedding (AI was unavailable when it was
// created), semantic weight is redistributed to category + keyword so
// matching still works without AI (spec #35).
//
//   semantic   0.45  - cosine similarity between request and item embeddings;
//                       the primary signal, since it understands meaning
//                       ("something for studying" ~ "wooden desk") rather
//                       than requiring identical category labels.
//   category   0.25  - same categoryId is a strong, cheap-to-trust signal.
//   location   0.15  - closer items are more useful; decays linearly to 0
//                       at maxDistanceKm.
//   condition  0.10  - whether the item's condition satisfies what was asked.
//   recency    0.05  - slight boost for newer donations, as a tiebreaker.
const WEIGHTS = { semantic: 0.45, category: 0.25, location: 0.15, condition: 0.1, recency: 0.05 };

const recencyScore = (createdAt) => {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - ageDays / 30); // linear falloff over 30 days
};

const locationScore = (distKm, maxDistanceKm) => {
    if (distKm == null || Number.isNaN(distKm)) return 0.5; // unknown location: neutral, don't penalize
    return Math.max(0, 1 - distKm / maxDistanceKm);
};

// Scores one (request, donation+item) pair. `requestEmbedding` and
// `itemEmbedding` may be null/undefined if AI was unavailable when either
// was created - the weight is then redistributed across whatever signals
// ARE available so a missing embedding never zeroes out a real match.
const scorePair = ({
    requestEmbedding,
    itemEmbedding,
    requestCategoryId,
    itemCategoryId,
    requestCondition,
    itemCondition,
    distKm,
    maxDistanceKm = DEFAULT_MATCH_DISTANCE_KM,
    itemCreatedAt,
}) => {
    const hasSemantic = Boolean(requestEmbedding?.length && itemEmbedding?.length);
    const activeWeights = { ...WEIGHTS };
    if (!hasSemantic) {
        // Redistribute the semantic weight proportionally across the rest.
        const remaining = 1 - WEIGHTS.semantic;
        for (const k of ["category", "location", "condition", "recency"]) {
            activeWeights[k] = WEIGHTS[k] / remaining;
        }
        activeWeights.semantic = 0;
    }

    const semantic = hasSemantic ? Math.max(0, cosineSimilarity(requestEmbedding, itemEmbedding)) : 0;
    const category =
        requestCategoryId && itemCategoryId && String(requestCategoryId) === String(itemCategoryId) ? 1 : 0;
    const location = locationScore(distKm, maxDistanceKm);
    const condition = isConditionCompatible(requestCondition, itemCondition) ? 1 : 0;
    const recency = recencyScore(itemCreatedAt);

    const score =
        activeWeights.semantic * semantic +
        activeWeights.category * category +
        activeWeights.location * location +
        activeWeights.condition * condition +
        activeWeights.recency * recency;

    return { score: Math.round(score * 1000) / 1000, breakdown: { semantic, category, location, condition, recency } };
};

// Ranks a list of { donation, item } candidates for a single request.
// Donors/requesters never see this raw breakdown - the API only exposes a
// final score used to sort a "Recommended for you" list (spec #27).
const rankCandidates = (request, candidates, { maxDistanceKm } = {}) => {
    const [reqLng, reqLat] = request.coordinates?.coordinates || [];
    return candidates
        .map(({ donation, item }) => {
            const [donLng, donLat] = donation.coordinates?.coordinates || [];
            const distKm =
                reqLat != null && donLat != null ? distanceKm([reqLng, reqLat], [donLng, donLat]) : null;
            const { score, breakdown } = scorePair({
                requestEmbedding: request.embedding,
                itemEmbedding: item.embedding,
                requestCategoryId: request.categoryId,
                itemCategoryId: item.categoryId,
                requestCondition: request.condition,
                itemCondition: item.condition,
                distKm,
                maxDistanceKm: maxDistanceKm || DEFAULT_MATCH_DISTANCE_KM,
                itemCreatedAt: donation.createdAt,
            });
            return { donation, item, score, distanceKm: distKm, breakdown };
        })
        .sort((a, b) => b.score - a.score);
};

module.exports = { WEIGHTS, scorePair, rankCandidates };
