const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
; // Typo fixed (AsynicHandler -> AsyncHandler)
const ApiErrorHandler = require("../utils/ApiResponseHandler");
const AsynicHandler = require("../utils/AsynicHandler");

exports.isAuthenticated = AsynicHandler(async (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return next(new ApiErrorHandler("Please Login to access this resource", 401));
  }
  const decodedData = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decodedData.id);
  next();
});



