import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import { sendMail } from "../utils/nodemailer.js";
import getOTP from "../utils/getOTP.js";
import { OTP } from "../models/otp.model.js";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";

const getCookieOptions = ({ persistent = false } = {}) => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(persistent
      ? {
          maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
        }
      : {}),
  };
};

const generateTokens = async (user_id) => {
  const user = await User.findById(user_id);

  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();

  if (!refreshToken || !accessToken) {
    throw new ApiError(500, "token generation failed");
  }

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

const registerUser = async (req, res) => {
  const { fullName, email, username, password } = req.body || {};
  if ([fullName, email, username, password].some((field) => !field)) {
    throw new ApiError(400, "All fields are required");
  }

  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar is required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    if (existedUser.email === email) {
      throw new ApiError(400, "Email already registered");
    }

    if (existedUser.username === username) {
      throw new ApiError(400, "Username is already occupied");
    }
  }

  const avatarLink = await uploadOnCloudinary(avatarLocalPath);
  if (!avatarLink) {
    throw new ApiError(500, "Error when getting avatarLink");
  }

  const user = await User.create({
    fullName,
    username,
    password,
    email,
    avatar: avatarLink.url,
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken -status",
  );

  return res.status(200).json(new ApiResponse(200, createdUser, "Success"));
};

const loginUser = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!(username || email)) {
    throw new ApiError(400, "username or email is required.");
  }

  if (!password) {
    throw new ApiError(200, "password is required.");
  }

  //find user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(400, "user not exist.");
  }

  const varified = await user.isPasswordCorrect(password);

  if (!varified) {
    throw new ApiError(400, "wrong password.");
  }
  //varified password
  const { refreshToken, accessToken } = await generateTokens(user?._id);

  const updatedUser = await User.findById(user?._id).select(
    "-password -status -refreshToken",
  );

  const options = getCookieOptions({ persistent: true });

  console.log(`login successful`);

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        {
          updatedUser,
          accessToken,
          refreshToken,
        },
        "login successful",
      ),
    );
};

const logoutUser = async (req, res) => {
  //check if user login by tokens

  const user = req.user;
  //remove refresh token from db

  if (!user) {
    throw new ApiError(401, "user is not in Database");
  }

  user.refreshToken = undefined;
  await user.save({ validateBeforeSave: false });

  const options = getCookieOptions();

  return res
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "success"));

  /*
  The approach is good but we need to create a middleware called Verify JWT that will get the cookies data and search on database that named by the ID is any user. Then it will go to the user and check the database user refresh token matching the web user refresh token or not. If it is matching it will send the user to respond sorry request dot user.
  */
};

const changeUserAvatar = async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "user is not varified");
  }
  //take new avatar from multer
  const newAvatar = req.file;
  if (!newAvatar) {
    throw new ApiError(400, "avatar is required");
  }

  const avatarLink = await uploadOnCloudinary(newAvatar?.path);
  if (!avatarLink) {
    throw new ApiError(500, "avatar upload failed");
  }
  user.avatar = avatarLink.url;
  const newUser = await user.save({ validateBeforeSave: false });

  return res.json(new ApiResponse(200, newUser, "avatar update successful"));
};

const refreshTokens = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    throw new ApiError(401, "refresh token not found");
  }

  let decoaded;
  try {
    decoaded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, "refresh token expired or invalid");
  }

  if (!decoaded?._id) {
    throw new ApiError(401, "invalid token payload");
  }

  // Verify refresh token exists in database
  const user = await User.findById(decoaded._id);
  if (!user || user.refreshToken !== refreshToken) {
    throw new ApiError(401, "refresh token mismatch or user not found");
  }

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    await generateTokens(decoaded._id);

  const options = getCookieOptions({ persistent: true });

  return res
    .status(200)
    .cookie("refreshToken", newRefreshToken, options)
    .cookie("accessToken", newAccessToken, options)
    .json(new ApiResponse(200, {}, "successfully refresh tokens"));
};

const sendOtpEmail = async (req, res) => {
  /*
  When a user goes to the endpoint, an email of OTP will send to user email that is in database. If the user enter OTP and proceed, it will go to another endpoint.
  */

  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400, "Authentication failed");
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(400, "user not found");
  }
  if (user.isVerified) {
    throw new ApiError(400, "user is already verified");
  }

  const generatedOtp = getOTP();
  if (!generatedOtp) {
    throw new ApiError(500, "OTP generation failed");
  }

  await sendMail(user.email, "Your Chatrix Verification Code", generatedOtp)
    .then(async () => {
      await OTP.findOneAndDelete({ user_id: userId.toString() });
      await OTP.create({
        otp: generatedOtp.toString(),
        user_id: userId.toString(),
      }).catch((err) => {
        throw new ApiError(500, "error when sending code");
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { user_id: userId },
            "OTP successfully send to Email",
          ),
        );
    })
    .catch(() => {
      throw new ApiError(500, "Email not send");
    });
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      throw new ApiError(400, "OTP is required.");
    }
    const userId = req.user?._id;
    if (!req.user?._id) {
      throw new ApiError(400, "Authentication failed");
    }

    const otpObj = await OTP.findOne({ user_id: userId.toString() }).sort({
      createdAt: -1,
    });
    if (!otpObj) {
      throw new ApiError(400, "OTP expired");
    }

    if (otp != otpObj.otp) {
      throw new ApiError(400, "OTP not matched");
    }

    //set user varified
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(400, "user not found when saving");
    }

    user.isVerified = true;
    await user.save({ validateBeforeSave: false });

    const newUser = await User.findById(userId).select(
      "-password -refreshToken -status",
    );

    if (!newUser) {
      throw new ApiError(500, "user not found when responding");
    }
    //delete otpObj
    await OTP.findByIdAndDelete(otpObj?._id);

    //return
    return res
      .status(200)
      .json(new ApiResponse(200, newUser, "user varification successful"));
  } catch (error) {
    throw new ApiError(400, error);
  }
};

const reSendOtp = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400, "Authentication failed");
  }
  const userOtpObj = await OTP.findOne({ user_id: userId.toString() });

  //if otpobj present then update,extend time  / if not create
  const generatedOtp = getOTP();
  if (userOtpObj) {
    if (Date.now() - userOtpObj.createdAt.getTime() <= 30000) {
      throw new ApiError(400, "please wait 30 seconds till send otp");
    }

    await sendMail(
      req.user.email,
      "Your Chatrix Verification Code",
      generatedOtp,
    )
      .then(async () => {
        userOtpObj.otp = generatedOtp.toString();
        userOtpObj.createdAt = Date.now();
        await userOtpObj.save({ validateBeforeSave: false });
      })
      .catch(() => {
        throw new ApiError(500, "email not send");
      });
  } else {
    //create otp object and send email
    await sendMail(
      req.user.email,
      "Your Chatrix Verification Code",
      generatedOtp,
    )
      .then(async () => {
        await OTP.create({
          otp: generatedOtp.toString(),
          user_id: userId.toString(),
        });
      })
      .catch(() => {
        throw new ApiError(500, "email not send");
      });
  }

  //===============HERE===============
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { status: "success" },
        "successfully resend code to email",
      ),
    );
};

const getUser = async (req, res) => {
  if (!req.user) {
    return res.json(
      new ApiError(401, "user not Autherized", {
        status: "failed",
        navigate: "/landing-page",
      }),
    );
  }

  if (!req.user?.isVerified) {
    return res.status(200).json(new ApiResponse(200, { profile: req.user }));
  }

  // if isvarified is true
  const conversations = await Conversation.aggregate([
    { $match: { participants: req.user?._id } },
    {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              password: 0,
              refreshToken: 0,
            },
          },
        ],
        as: "participants",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "admins",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              password: 0,
              refreshToken: 0,
            },
          },
        ],
        as: "admins",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              password: 0,
              refreshToken: 0,
            },
          },
        ],
        as: "createdBy",
      },
    },
    {
      $addFields: {
        createdBy: {
          $first: "$createdBy",
        },
      },
    },
  ]);
  //=========================================================================

  return res
    .status(200)
    .json(
      new ApiResponse(200, { profile: req.user, conversations: conversations }),
    );
};

const createConversation = async (req, res) => {
  const authUser = req.user;
  //body
  const { groupName } = req.body;

  if (!groupName) {
    throw new ApiError(400, "Group Name is required");
  }

  if (groupName.length <= 2) {
    throw new ApiError(400, "Group Name is too small");
  }

  //avatar
  const groupAvatarPath = req.file?.path;
  if (!groupAvatarPath) {
    throw new ApiError(400, "Avatar is required");
  }
  //upload avatar
  const avatarLink = await uploadOnCloudinary(groupAvatarPath);

  if (!avatarLink) {
    throw new ApiError(500, "Avatar upload failed.");
  }

  const newConversation = await Conversation.create({
    participants: [authUser._id],
    groupName: groupName,
    groupAvatar: avatarLink.url,
    admins: [authUser._id],
    createdBy: authUser._id,
  });

  if (!newConversation) {
    throw new ApiError(500, "Conversation not created.");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        newConversation,
        "successfully created new conversation.",
      ),
    );
};

const addMember = async (req, res) => {
  try {
    //requered fields
    const { usernameOrEmail, conversationId } = req.body;
    if (!usernameOrEmail) {
      throw new ApiError(400, "username or email is requered.");
    }
    if (!conversationId) {
      throw new ApiError(
        400,
        "conversation id not found when processing add member.",
      );
    }

    //find user
    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });

    if (!user) {
      throw new ApiError(400, "member not found.");
    }

    //find conversation
    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversationId.trim(),
      {
        $addToSet: {
          participants: user?._id, //it can be use to add multiple user id than single id
        },
      },
    );

    if (!updatedConversation) {
      throw new ApiError(400, "Invalid conversation or DB error");
    }

    return res.status(200).json(new ApiResponse(200, { newUser: user }));
  } catch (error) {
    throw new ApiError(500, "Internal Server Error when adding member");
  }
};

const getMessages = async (req, res) => {
  const verifiedUser = req.user;
  if (!verifiedUser?._id) {
    throw new ApiError(401, "Authentication failed");
  }

  const { conversationId } = req.body;
  if (!conversationId) {
    throw new ApiError(400, "Conversation ID is requered to get messages");
  }

  //find conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(400, "conversation id is not valid");
  }

  //check if user is participant of the conversation
  const isParticipant = conversation.participants.some(
    (id) => id?.toString() === verifiedUser._id.toString(),
  );
  if (!isParticipant) {
    throw new ApiError(
      400,
      "You are not eligible because you are not member of the conversation.",
    );
  }

  const allMessages = await Message.aggregate([
    { $match: { conversationId: conversation._id } },
    {
      $lookup: {
        from: "users",
        localField: "sender",
        foreignField: "_id",
        as: "sender",
        pipeline: [
          {
            $project: {
              password: 0,
              isVerified: 0,
              refreshToken: 0,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "conversations",
        localField: "conversationId",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              participants: 0,
              lastMessage: 0,
              groupAvatar: 0,
              admins: 0,
              createdBy: 0,
            },
          },
        ],
        as: "conversationId",
      },
    },
    {
      $addFields: {
        conversation: {
          $first: "$conversationId",
        },
      },
    },
    {
      $addFields: {
        sender: {
          $first: "$sender",
        },
      },
    },
    {
      $project: {
        conversationId: 0,
      },
    },
  ]);

  //send response
  return res
    .status(200)
    .json(new ApiResponse(200, { messages: allMessages, date: Date.now() }));
};

const leaveConversation = async (req, res) => {
  try {
    //auth
    const verifiedUser = req.user;
    if (!verifiedUser) {
      throw new ApiError(401, "Authentication failed.");
    }

    //get all requered fields and verify
    const { conversationId } = req.body;
    if (!conversationId) {
      throw new ApiError(400, "conversationId is requered.");
    }
    //try to find conversation
    const userConversation = await Conversation.findById(conversationId);
    if (!userConversation) {
      throw new ApiError(400, "conversation not found.");
    }

    //check if user is a perticipant or not
    const isAdmin = userConversation.admins.some((adminId) => {
      return adminId.equals(verifiedUser._id);
    });

    const isParticipant = userConversation.participants.some((userId) => {
      return userId.equals(verifiedUser._id);
    });

    if (isAdmin && userConversation.admins.length === 1) {
      throw new ApiError(
        400,
        "You can't leave conversation, you can delete it.",
      );
    }

    if (!isParticipant) {
      throw new ApiError(400, "user is not participant of the conversation.");
    }
    //let the admin leave if there is multiple admins
    //if admin
    if (isAdmin) {
      userConversation.admins = userConversation.admins.filter((adminId) => {
        return !adminId.equals(verifiedUser._id);
      });
    }

    //for all admin & non-admins
    userConversation.participants = userConversation.participants.filter(
      (userId) => {
        return !userId.equals(verifiedUser._id);
      },
    );

    //save
    await userConversation.save({ validateBeforeSave: false });
    //send final response
    res.json(
      new ApiResponse(
        200,
        { message: "successfully leaved conversation" },
        "successfully leaved conversation",
      ),
    );
  } catch (error) {
    throw new ApiError(500, "Internal Server Error");
  }
};

const deleteConversation = async (req, res) => {
  try {
    //auth
    const verifiedUser = req.user;
    if (!verifiedUser) {
      throw new ApiError(401, "Authentication failed.");
    }

    //get all requered fields and verify
    const { conversationId } = req.body;
    if (!conversationId) {
      throw new ApiError(400, "conversationId is requered.");
    }
    //try to find conversation
    const userConversation = await Conversation.findById(conversationId);
    if (!userConversation) {
      throw new ApiError(400, "conversation not found.");
    }

    //check if admin
    const isAdmin = userConversation.admins.some((adminId) => {
      return adminId.equals(verifiedUser._id);
    });

    if (!isAdmin) {
      throw new ApiError(
        400,
        "only admins have the permission to delete conversation.",
      );
    }

    //delete conversation
    await Conversation.findByIdAndDelete(userConversation._id);
    //delete messages
    await Message.deleteMany({ conversationId: userConversation._id });

    //send response
    res.json(
      new ApiResponse(
        200,
        { message: "successfully deleted the conversation." },
        "successfully deleted the conversation.",
      ),
    );
  } catch (error) {
    throw new ApiError(500, "Internal Server Error.");
  }
};

export {
  getUser,
  registerUser,
  loginUser,
  logoutUser,
  changeUserAvatar,
  refreshTokens,
  sendOtpEmail,
  verifyOtp,
  reSendOtp,
  createConversation,
  addMember,
  getMessages,
  leaveConversation,
  deleteConversation,
};
