import express from "express";
const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import ApiResponse from "./src/utils/ApiResponse.js";

const corsOrigin =
  process.env.CORS_ORIGIN === "*" ? true : process.env.CORS_ORIGIN || true;

if (process.env.CORS_ORIGIN === "*") {
  console.warn(
    "Warning: CORS_ORIGIN is set to '*'. Using reflective origin to allow credentials.",
  );
}

// Expose the email template only on a dedicated path instead of the API root.
app.use(express.static("public"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Chatrix backend is running" });
});
//CORS Setup
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Log CORS headers for debugging
app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(
      `CORS -> origin: ${res.getHeader("Access-Control-Allow-Origin")}, credentials: ${res.getHeader("Access-Control-Allow-Credentials")}`,
    );
  });
  next();
});

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
