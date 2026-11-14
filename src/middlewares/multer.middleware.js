import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public");
  },
  filename: function (req, file, cb) {
    const rdmUID = crypto.randomUUID();
    cb(null, `${rdmUID}-${file.originalname}`);
  },
});

export const upload = multer({
  storage,
});
