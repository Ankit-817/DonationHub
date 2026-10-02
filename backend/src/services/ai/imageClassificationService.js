const { classifyImageJSON } = require("./providerClient");
const { suggestCategoryForText } = require("./categoryService");

// Spec #28: image -> short predicted item label (NOT a category name -
// the label is then run back through categoryService so the dynamic
// MongoDB category list, not the vision model, has the final say on
// which category it maps to).
const describeImage = async (imageUrl) => {
    const result = await classifyImageJSON({
        imageUrl,
        instructions:
            'Identify the single physical item in this photo. Respond with JSON ' +
            '{"itemLabel": string, "visibleCondition": "new"|"like_new"|"used"|"unclear"}. ' +
            "itemLabel should be 1-4 words, e.g. \"bicycle\", \"wooden study desk\", \"winter jacket\".",
    });
    return {
        itemLabel: result?.itemLabel || null,
        visibleCondition: result?.visibleCondition || "unclear",
    };
};

// Spec #29: combine the donor's own text with what the image shows into
// one fused description before doing category matching, rather than
// trusting the image alone. If text is missing, the image label alone
// drives the match; if the image call fails, we fall back to text-only
// (caller decides - see controller).
const classifyFromTextAndImage = async ({ text, imageUrl }) => {
    let imageResult = null;
    if (imageUrl) {
        imageResult = await describeImage(imageUrl); // may throw AIUnavailableError
    }

    const fusedText = [text, imageResult?.itemLabel].filter(Boolean).join(". ");
    const suggestion = await suggestCategoryForText(fusedText || text);

    return {
        imageLabel: imageResult?.itemLabel || null,
        visibleCondition: imageResult?.visibleCondition || "unclear",
        ...suggestion,
    };
};

module.exports = { describeImage, classifyFromTextAndImage };
