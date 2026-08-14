import express from "express";
import cors from "cors";
import { PORT, ALLOWED_ORIGINS } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { uploadDir } from "./middleware/upload.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routes/index.js";

const app = express();

// ================= CORS & MIDDLEWARE =================
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching allowed origins
      if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app") || origin.includes("localhost")) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive CORS for smooth POS integration
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static file serving for uploads
app.use("/uploads", express.static(uploadDir));

// ================= API ROUTING =================
// Mount all modular endpoints cleanly under /api
app.use("/api", apiRouter);

// Global error handler
app.use(errorHandler);

// ================= INITIALIZATION =================
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Greenleaf POS Server running on http://localhost:${PORT}`);
    console.log(`API Health Check available at http://localhost:${PORT}/api/health`);
  });
});

export default app;
