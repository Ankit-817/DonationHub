/**
 * One-off CLI script to promote a user to admin.
 * Since the API intentionally never accepts isAdmin from a client (to
 * prevent privilege escalation), the very first admin has to be created
 * this way.
 *
 * Usage:
 *   node src/scripts/makeAdmin.js someone@example.com
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const email = process.argv[2];

if (!email) {
  console.error("Usage: node src/scripts/makeAdmin.js <email>");
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    const user = await User.findOneAndUpdate({ email }, { isAdmin: true }, { new: true });
    if (!user) {
      console.error(`No user found with email ${email}`);
    } else {
      console.log(`✅ ${user.name} (${user.email}) is now an admin.`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
