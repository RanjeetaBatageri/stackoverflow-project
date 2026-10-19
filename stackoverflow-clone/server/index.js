import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import userroutes from "./routes/auth.js";
import questionroute from "./routes/question.js";
import answerroutes from "./routes/answer.js";
import subscriptionroutes from "./routes/subscription.js";
import postroutes from "./routes/post.js";

dotenv.config();

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://stackoverflow-project-eosin.vercel.app",
  "http://localhost:3000",
];

const envFrontend = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/+$/, "") : null;
const allowedOrigins = envFrontend
  ? Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, envFrontend]))
  : DEFAULT_ALLOWED_ORIGINS;

const corsOptions = {
  origin: (origin, callback) => {
    // Normalize incoming origin by removing trailing slashes if present
    const normalizedOrigin = origin ? origin.replace(/\/+$/, "") : origin;
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin) || process.env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin ${origin} not allowed`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "device-fingerprint"],
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));



app.get("/", (req, res) => {
  res.send("Stackoverflow clone is running perfect");
});

app.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? "healthy" : "database_disconnected",
    dbReadyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

app.use("/user", userroutes);
app.use("/question", questionroute);
app.use("/answer", answerroutes);
app.use("/subscription", subscriptionroutes);
app.use("/post", postroutes);

const PORT = process.env.PORT || 5000;
const databaseurl = process.env.MONGODB_URL || "mongodb://localhost:27017/stackoverflow";

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT} (0.0.0.0)`);
});

mongoose
  .connect(databaseurl)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });
