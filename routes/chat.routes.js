const express = require("express");

const router = express.Router();

const {
  sendMessage,
  getChatMessages,
  getMyChats,
} = require("../controller/chat.controller");

const verifyToken = require("../middleware/auth.middleware");

router.post(
  "/send",
  verifyToken,
  sendMessage
);

router.get(
  "/my-chats",
  verifyToken,
  getMyChats
);

router.get(
  "/:carId/:otherUserId",
  verifyToken,
  getChatMessages
);

module.exports = router;
