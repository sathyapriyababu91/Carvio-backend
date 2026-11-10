const express = require("express");

const router = express.Router();

const upload = require("../middleware/upload.middleware");
const { uploadImage } = require("../controller/image.controller");

router.post("/image", upload.single("image"), uploadImage);

module.exports = router;

