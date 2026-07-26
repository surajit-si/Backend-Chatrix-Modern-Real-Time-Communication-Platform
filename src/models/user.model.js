import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userColors = [
  "#FF6B6B",
  "#FF8E72",
  "#FFB347",
  "#FFD700",
  "#F4D03F",
  "#82E0AA",
  "#58D68D",
  "#5DADE2",
  "#5499C7",
  "#AF7AC5",
  "#D7BDE2",
  "#F1948A",
  "#E74C3C",
  "#76D7C4",
  "#48C9B0",
  "#A2D9CE",
  "#D2B4DE",
  "#A9CCE3",
  "#AED6F1",
  "#F9E79F",
  "#F5CBA7",
  "#EDBB99",
  "#E59866",
  "#D7BDE2",
  "#D2B4DE",
  "#F7DC6F",
  "#F8C471",
  "#EB984E",
  "#D35400",
  "#C0392B",
];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      lowercase: true,
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      required: true,
    },
    textColor: {
      type: String,
      required: true,
      default: function () {
        const randonIDX = Math.floor(Math.random() * userColors.length);

        return userColors[randonIDX];
      },
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = async function () {
  return await jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRE,
    },
  );
};

userSchema.methods.generateRefreshToken = async function () {
  return await jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE,
    },
  );
};

export const User = mongoose.model("User", userSchema);
