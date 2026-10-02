// Run with: npm run seed-categories
// Requires MONGO_URL and, ideally, AI_API_KEY (so embeddings are generated
// immediately - without it, categories are created without embeddings and
// will simply be excluded from AI matching until re-embedded, per the
// graceful-degradation rule in categoryService).
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const mongoose = require("mongoose");
const Category = require("../models/Category");
const { ensureCategoryEmbedding, getOrCreateCategory } = require("../services/ai/categoryService");

// A starting point only - NOT an enum enforced anywhere in the app.
// Admins/users can add more at any time via POST /api/categories, and the
// AI will propose new ones automatically when nothing here fits.
const STARTER_CATEGORIES = [
    { name: "Clothing", description: "Shirts, pants, jackets, and other wearable items", aliases: ["clothes", "apparel", "garments"] },
    { name: "Footwear", description: "Shoes, sandals, boots", aliases: ["shoes", "sneakers", "sandals"] },
    { name: "Books", description: "Books, textbooks, novels, educational reading material", aliases: ["novels", "textbooks"] },
    { name: "Furniture", description: "Tables, chairs, desks, sofas, cabinets, shelving", aliases: ["desk", "table", "chair", "sofa", "cabinet", "bookshelf"] },
    { name: "Electronics", description: "Computers, phones, TVs, and other electronic devices", aliases: ["gadgets", "devices"] },
    { name: "Computer Accessories", description: "Keyboards, mice, cables, laptop stands and other computer peripherals", parentHint: "Electronics", aliases: ["keyboard", "mouse", "laptop stand"] },
    { name: "Kitchen & Household", description: "Cookware, utensils, small appliances, home goods", aliases: ["household", "kitchenware", "appliances"] },
    { name: "Toys & Games", description: "Children's toys, board games, puzzles", aliases: ["toys", "games"] },
    { name: "Baby & Kids Equipment", description: "Strollers, cribs, car seats, and other baby/child gear", aliases: ["baby gear", "baby equipment", "stroller", "crib"] },
    { name: "Sports & Outdoor", description: "Sporting goods, camping and outdoor equipment", aliases: ["camping gear"] },
    { name: "Bicycles", description: "Bicycles and cycles for adults and children", aliases: ["bicycle", "bike", "bikes", "cycle", "cycles", "mountain bike", "kids bicycle", "kids cycle"] },
    { name: "School Supplies", description: "Stationery and other educational materials", aliases: ["stationery"] },
    { name: "Backpacks / School Bags", description: "Backpacks, school bags and book bags", aliases: ["backpack", "backpacks", "school bag", "school bags", "book bag"] },
    { name: "Other", description: "Items that don't fit an existing category", aliases: ["misc", "miscellaneous"] },
];

const run = async () => {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB - seeding categories...");

    await Category.updateOne(
        { slug: "sports-outdoor" },
        { $pull: { aliases: { $in: ["bicycle", "bike", "bikes", "cycle", "cycles", "mountain bike", "kids bicycle", "kids cycle"] } } }
    );
    await Category.updateOne(
        { slug: "school-supplies" },
        { $pull: { aliases: { $in: ["backpack", "backpacks", "school bag", "school bags", "book bag"] } } }
    );

    const created = [];
    for (const def of STARTER_CATEGORIES) {
        const slug = Category.slugify(def.name);
        let category = await Category.findOne({ slug });
        let wasCreated = false;
        if (!category) {
            if (["Bicycles", "Backpacks / School Bags"].includes(def.name)) {
                category = await Category.create({ ...def, slug, createdBy: "admin" });
                wasCreated = true;
            } else {
                ({ category, created: wasCreated } = await getOrCreateCategory({
                    name: def.name,
                    description: def.description,
                    aliases: def.aliases,
                    createdBy: "admin",
                }));
            }
        }
        const aliasesChanged = JSON.stringify(category.aliases || []) !== JSON.stringify(def.aliases);
        const descriptionChanged = category.description !== def.description;
        if (aliasesChanged || descriptionChanged) {
            category.embedding = undefined;
            category.embeddingModel = "";
        }
        category.aliases = def.aliases;
        category.description = def.description;
        await category.save();
        await ensureCategoryEmbedding(category);
        created.push({ name: category.name, wasCreated });
    }

    console.table(created);
    console.log("Done.");
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
