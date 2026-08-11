import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  changeUserAvatar,
  refreshTokens,
  sendOtpEmail,
  verifyOtp,
  reSendOtp,
  getUser,
  createConversation,
  addMember,
  getMessages,
  leaveConversation,
  deleteConversation,
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import varifyJWT from "../middlewares/varifyJWT.js";
import varifyJWTNoOtp from "../middlewares/varifyJWTNoOtp.js";

// Async handler wrapper to catch errors in async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const router = Router();

router.route("/").get(upload.none(), varifyJWTNoOtp, asyncHandler(getUser));
router
  .route("/register")
  .post(upload.single("avatar"), asyncHandler(registerUser));
router.route("/login").post(upload.none(), asyncHandler(loginUser));
router
  .route("/logout")
  .get(upload.none(), varifyJWT, asyncHandler(logoutUser));
router
  .route("/change-avatar")
  .post(upload.single("avatar"), varifyJWT, asyncHandler(changeUserAvatar));
router.route("/refreshTokens").get(upload.none(), asyncHandler(refreshTokens));

router
  .route("/verify-email")
  .get(upload.none(), varifyJWTNoOtp, asyncHandler(sendOtpEmail));
router
  .route("/verify-otp")
  .post(upload.none(), varifyJWTNoOtp, asyncHandler(verifyOtp));
router
  .route("/resend-otp")
  .get(upload.none(), varifyJWTNoOtp, asyncHandler(reSendOtp));
router
  .route("/create-conversation")
  .post(upload.single("avatar"), varifyJWT, asyncHandler(createConversation));
router.route("/add-member").post(upload.none(), asyncHandler(addMember));
router
  .route("/get-messages")
  .post(upload.none(), varifyJWT, asyncHandler(getMessages));
router
  .route("/leave-conversation")
  .post(upload.none(), varifyJWT, asyncHandler(leaveConversation));
router
  .route("/delete-conversation")
  .post(upload.none(), varifyJWT, asyncHandler(deleteConversation));

export default router;
