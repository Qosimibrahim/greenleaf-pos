import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || "greenleaf-secret-key-12345";
export const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/greenleaf-stockroom";

export const ALLOWED_ORIGINS = [
  "https://greenleaf-pos.vercel.app",
  "https://greenleaf-pos-api.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
];
