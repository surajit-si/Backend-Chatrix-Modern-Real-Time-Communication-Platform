import ApiResponse from "../utils/ApiResponse.js";

export const stayAwake = (req, res) => {
  return res.json(new ApiResponse(200, {}, "stay awake"));
};
