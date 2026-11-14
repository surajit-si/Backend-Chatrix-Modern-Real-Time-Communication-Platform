import { v2 as cloudinary } from "cloudinary";
import ApiError from "./ApiError.js";
import fs from "fs/promises";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

async function uploadOnCloudinary(filePath) {
  if (!filePath) {
    throw new ApiError(500, "file path not found when uploading file to db.");
  }
  try {
    const file = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    await fs.unlink(filePath);
    return file;
  } catch (error) {
    console.error("Cloudinary Error Detail:", error);
    await fs.unlink(filePath).catch(() => {}); // Clean up local file even on failure
    throw new ApiError(500, "Cloudinary upload failed", error.message || error);
  }
}

function extractPublicId(url) {
  // Matches everything after /upload/ (skipping optional transformations and version), up to the file extension
  const regex = /\/upload\/(?:[^/]+\/)?(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function deleteFromCloudinary(url) {
  const public_id = extractPublicId(url);

  try {
    const result = await cloudinary.uploader.destroy(public_id);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw error;
  }
}

export default uploadOnCloudinary;
export { deleteFromCloudinary };
