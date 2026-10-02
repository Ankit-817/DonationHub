const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");

const userRoute = require("./routes/user");
const donationRoute = require("./routes/donation");
const requestRoute = require("./routes/request");
const transactionRoute = require("./routes/transaction");
const impactRoute = require("./routes/impact");
const notificationRoute = require("./routes/notification");
const messageRoute = require("./routes/message");
const adminRoute = require("./routes/admin");
const categoryRoute = require("./routes/category");

const { setSocketIO, initSocket } = require("./socket");
const { errorHandler, notFound } = require("./utils/errorHandler");
const { generalLimiter } = require("./middlewares/rateLimit");

const app = express();
const server = http.createServer(app);

// Render forwards client details through one trusted proxy hop. Trusting
// that hop lets rate limiting use the real client IP instead of rejecting
// Render's X-Forwarded-For header as spoofed.
if (process.env.NODE_ENV === "production" || process.env.RENDER) {
    app.set("trust proxy", 1);
}

const io = new Server(server, {
    cors: {
        origin: process.env.FRONT_URL,
        methods: ["GET", "POST"],
        credentials: true,
    },
});
setSocketIO(io);
initSocket(io); // authenticates sockets + chat-room logic (chat only, see socket.js)

// Secure headers (spec #13). CSP is left to the frontend's own hosting
// layer since this is a pure JSON API with no server-rendered HTML.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cookieParser());
// Request bodies are capped (spec #13) - donation/request text is short;
// Cloudinary uploads go through multipart/multer, not this JSON body.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
    cors({
        // Production CORS only ever allows the one deployed frontend origin
        // (spec #13) - never a wildcard for this authenticated API.
        origin: process.env.FRONT_URL,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
app.use(generalLimiter);

app.get("/", (req, res) => {
    res.send("Donation Hub backend is running.");
});

// Deployment/monitoring health check (spec #51). Deliberately does not
// touch the database so it stays fast and cheap for a load balancer to
// poll; MongoDB connection state is still reported for visibility.
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            status: "ok",
            uptimeSeconds: Math.round(process.uptime()),
            mongoConnected: mongoose.connection.readyState === 1,
            aiConfigured: Boolean(process.env.AI_API_KEY),
        },
    });
});

app.use("/api/users", userRoute);
app.use("/api/donations", donationRoute);
app.use("/api/requests", requestRoute);
app.use("/api/transactions", transactionRoute);
app.use("/api/impact", impactRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/admin", adminRoute);
app.use("/api/categories", categoryRoute);

app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB BEFORE accepting any HTTP traffic, so the app never
// serves requests against a database that isn't ready yet.
const start = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Connected to MongoDB");

        server.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
});

start();
