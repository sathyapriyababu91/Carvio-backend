const Message = require("../model/message.model");
const Car = require("../model/car.model");

const {
  getSocketIO,
} = require("../utils/socket");

const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;

    const {
      receiverId,
      carId,
      message,
    } = req.body;

    if (!receiverId || !carId || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Receiver, car and message are required",
      });
    }

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    const car = await Car.findById(carId);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (!car.seller) {
      return res.status(400).json({
        success: false,
        message:
          "Seller information not available for this vehicle",
      });
    }

    const sellerId = car.seller.toString();
    const sender = senderId.toString();
    const receiver = receiverId.toString();

    console.log("CHAT DEBUG");
    console.log("Sender ID:", sender);
    console.log("Receiver ID:", receiver);
    console.log("Car ID:", carId);
    console.log("Car Seller ID:", sellerId);

    if (sender === receiver) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot chat with yourself",
      });
    }

    const validConversation =
      (sender === sellerId &&
        receiver !== sellerId) ||
      (receiver === sellerId &&
        sender !== sellerId);

    if (!validConversation) {
      console.log(
        "CHAT REJECTED: neither sender nor receiver is the car seller"
      );

      return res.status(403).json({
        success: false,
        message:
          "You are not authorized for this vehicle chat",
      });
    }

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      car: carId,
      message: cleanMessage,
    });

    const savedMessage =
      await Message.findById(
        newMessage._id
      )
        .populate(
          "sender",
          "name phone"
        )
        .populate(
          "receiver",
          "name phone"
        )
        .populate(
          "car",
          "title brand modelName price images"
        );

    const io = getSocketIO();

    if (io) {
      io.to(`user:${receiver}`).emit(
        "new_message",
        savedMessage
      );

      console.log(
        "REAL-TIME MESSAGE SENT TO:",
        `user:${receiver}`
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Message sent successfully",
      data: savedMessage,
    });

  } catch (error) {
    console.log(
      "SEND MESSAGE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to send message",
    });
  }
};

const getChatMessages = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      carId,
      otherUserId,
    } = req.params;

    if (!carId || !otherUserId) {
      return res.status(400).json({
        success: false,
        message:
          "Car ID and user ID are required",
      });
    }

    const messages = await Message.find({
      car: carId,

      $or: [
        {
          sender: userId,
          receiver: otherUserId,
        },
        {
          sender: otherUserId,
          receiver: userId,
        },
      ],
    })
      .sort({
        createdAt: 1,
      })
      .populate(
        "sender",
        "name phone"
      )
      .populate(
        "receiver",
        "name phone"
      );

    // The logged-in user has opened this conversation, so every message
    // sent to them in it is now read.
    await Message.updateMany(
      {
        car: carId,
        sender: otherUserId,
        receiver: userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return res.status(200).json({
      success: true,
      messages,
    });

  } catch (error) {
    console.log(
      "GET CHAT MESSAGES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load chat messages",
    });
  }
};

const getMyChats = async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({
      $or: [
        {
          sender: userId,
        },
        {
          receiver: userId,
        },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .populate(
        "sender",
        "name phone"
      )
      .populate(
        "receiver",
        "name phone"
      )
      .populate(
        "car",
        "title brand modelName price images"
      );

    const chats = [];
    const chatMap = new Map();

    for (const message of messages) {
      // A deleted car or user populates as null; skip those messages
      // instead of crashing the whole chat list.
      if (
        !message.car ||
        !message.sender ||
        !message.receiver
      ) {
        continue;
      }

      const otherUser =
        String(message.sender._id) ===
        String(userId)
          ? message.receiver
          : message.sender;

      const chatKey =
        `${message.car._id}_${otherUser._id}`;

      if (!chatMap.has(chatKey)) {
        const unreadCount =
          await Message.countDocuments({
            car: message.car._id,

            sender: otherUser._id,

            receiver: userId,

            isRead: false,
          });

        const chat = {
          car: message.car,
          user: otherUser,
          lastMessage: message.message,
          lastMessageAt: message.createdAt,
          unreadCount,
        };

        chatMap.set(chatKey, chat);

        chats.push(chat);
      }
    }

    return res.status(200).json({
      success: true,
      chats,
    });

  } catch (error) {
    console.log(
      "GET MY CHATS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load chats",
    });
  }
};

module.exports = {
  sendMessage,
  getChatMessages,
  getMyChats,
};