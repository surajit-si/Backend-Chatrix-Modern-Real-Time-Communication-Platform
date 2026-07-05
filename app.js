import express from "express";
const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import ApiResponse from "./src/utils/ApiResponse.js";

// Expose the email template only on a dedicated path instead of the API root.
app.use(express.static("public"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Chatrix backend is running" });
});
//CORS Setup
const allowedOrigins =
  process.env.CORS_ORIGIN === "*"
    ? true
    : (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

//routers
import userRouter from "./src/routes/user.routes.js";

//user router
app.use("/api/v1/users", userRouter);

// Global error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error("Error:", err?.stack || err);

  res.status(statusCode).json(new ApiResponse(statusCode, null, message));
});

export { app };
