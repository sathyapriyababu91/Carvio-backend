const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ success: false, message: "Access Denied! No token provided." });
  }

  try {
    // Bearer <token> format-la vandha split panrom
    const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET || "secret_key");
    req.user = verified; // user id and role request-la save agum
    next();
  } catch (err) {
    res.status(400).json({ success: false, message: "Invalid Token!" });
  }
};

module.exports = verifyToken;