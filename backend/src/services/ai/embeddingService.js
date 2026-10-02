const { createEmbedding } = require("./providerClient");

// Cosine similarity between two equal-length vectors, in [-1, 1].
// Pure JS on purpose: the project runs on plain MongoDB (confirmed - no
// Atlas Vector Search), so similarity search happens in the Node process
// against a modestly sized category/document list rather than in the DB.
// This is fine at the scale a $vectorSearch migration would target later;
// if the category/item collections grow into the tens of thousands, swap
// this file's `rankBySimilarity` for an Atlas $vectorSearch aggregation
// without touching any caller.
const cosineSimilarity = (a, b) => {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Generates an embedding for free text. Throws AIUnavailableError (via
// providerClient) if AI isn't configured or the call fails - callers must
// catch this and fall back to non-AI behavior (spec #35).
const embedText = async (text) => {
    const clean = (text || "").trim();
    if (!clean) return null;
    const { embedding, model } = await createEmbedding(clean);
    return { embedding, model };
};

// Given a query embedding and a list of { id, embedding, ...rest }, returns
// the same items sorted by descending similarity with a `score` attached.
const rankBySimilarity = (queryEmbedding, candidates) => {
    return candidates
        .map((c) => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .sort((a, b) => b.score - a.score);
};

module.exports = { cosineSimilarity, embedText, rankBySimilarity };
