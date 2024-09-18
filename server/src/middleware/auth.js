const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const AsyncHandler = require("../utils/AsynicHandler");
const ApiErrorHandler = require("../utils/ApiResponseHandler");

exports.isAuthenticated = AsyncHandler(async (req, res, next) => {
  const { token } = req.cookies; // assuming token is stored in cookies

  if (!token) {
    return next(new ApiErrorHandler("Please login to access this resource", 401));
  }

  const decodedData = jwt.verify(token, process.env.JWT_SECRET_KEY);
  req.user = await User.findById(decodedData.id);

  next();
});
