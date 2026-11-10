const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const cors = require("cors");

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const dbConnection = require("./Config/dbConnection.config");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const carRoutes = require("./routes/car.routes");
const paymentRoutes = require("./routes/payment.routes");
const uploadRoutes = require("./routes/upload.routes");
const chatRoutes = require("./routes/chat.routes");
const aiRoutes = require("./routes/ai.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const {
  setSocketIO,
} = require("./utils/socket");

// Production safety: never run with the fallback JWT secret
if (
  process.env.NODE_ENV === "production" &&
  !process.env.JWT_SECRET
) {
  console.error(
    "JWT_SECRET is missing. Set it in the hosting environment variables."
  );
  process.exit(1);
}

const app = express();

// Behind a hosting proxy (Render, Railway etc.) so rate limit sees the real IP
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Give Socket.IO instance to chat system
setSocketIO(io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/car", carRoutes);
app.use("/user", userRoutes);
app.use("/payment", paymentRoutes);
app.use("/upload", uploadRoutes);
app.use("/chat", chatRoutes);
app.use("/ai", aiRoutes);
app.use("/feedbacks", feedbackRoutes);

// Socket.IO Authentication
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication token required")
      );
    }

    const cleanToken = token.replace(
      /^Bearer\s+/i,
      ""
    );

    const verified = jwt.verify(
      cleanToken,
      process.env.JWT_SECRET || "secret_key"
    );

    const userId =
      verified.id ||
      verified.userId ||
      verified._id;

    if (!userId) {
      return next(
        new Error("User ID not found in token")
      );
    }

    socket.userId = String(userId);

    next();

  } catch (error) {
    next(
      new Error("Invalid or expired token")
    );
  }
});

// Socket connection
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  console.log("Authenticated user:", socket.userId);

  const userRoom = `user:${socket.userId}`;

  socket.join(userRoom);

  console.log("Joined room:", userRoom);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// DB Connection
dbConnection();

// Server Start
const PORT =
  process.env.PORT || 8080;

server.listen(PORT, () => {

  console.log(
    `Server up and running on port ${PORT}`
  );

});