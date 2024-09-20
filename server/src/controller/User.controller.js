const AsyncHandler = require("../utils/AsynicHandler");
const User = require('../models/User.model');
const sendToken = require('../utils/sendToken'); // Ensure this is the correct import
const crypto = require('crypto');
const ApiErrorHandler = require("../utils/ApiError.js");
const AsynicHandler = require("../utils/AsynicHandler");
const apifeatucher = require("../utils/Search.js");


exports.Register = AsyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  // Check if any field is empty
  if (!name || !email || !password) {
    return next(new ApiErrorHandler(400, "All fields are required"));
  }

  // Check if user already exists
  const existedUser = await User.findOne({ email });
  if (existedUser) {
    return next(new ApiErrorHandler("User with this email already exists", 409));
  }

  // Generate random secret key
  const secretKey = crypto.randomBytes(32).toString('hex');

  // Create a new user with the generated secret key
  const user = await User.create({
    name,
    email,
    password,
    secretKey, // Pass the generated secret key here
  });

  // Send the JWT token and the secret key in the response
  sendToken(user, 201, res, user.secretKey);
});

exports.Login = AsyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if ([email, password].some((field) => field?.trim() === "")) {
    throw next(new ApiErrorHandler(400, "All fields are required"));
  }

  
  
  
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw next(new ApiErrorHandler(400, "User not found"));
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw next(new ApiErrorHandler(401, "Invalid email or password"));
  }

  sendToken(user, 200, res);
});

// LogOut User
exports.Logout=AsyncHandler(async(req,res,next)=>{
  res.cookie("token",null,{
    expires:new Date(Date.now()),
    httpOnly:true,
  })
  res.status(200).json({
    success:true,
    message:" User  Logged Out successfully",
  })
})
// Get all Loguin user 
exports.getLoginUser=AsyncHandler(async(req,res,next)=>{
try {
  const usercount=await User.countDocuments()
  res.status(200).json({
    success:true,
    count:usercount,
  })
} catch (error) {
  console.log('Error feaching user '+error)
  res.status(500).json({
    success:false,
    error: "Server Error",
  })
}
})

exports.getUser = AsyncHandler(async (req, res, next) => {
  try {
    const { keyword, date } = req.query;

    // Build query
    const query = {};
    if (keyword) {
      query.$or = [
        { senderNumber: { $regex: keyword, $options: 'i' } },
        { recipientNumber: { $regex: keyword, $options: 'i' } },
        { messageContent: { $regex: keyword, $options: 'i' } }
      ];
    }
    if (date) {
      // Parse date to ensure it's in the correct format
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) { // Check if date is valid
        query.timestamp = { $gte: parsedDate };
      }
    }

    // Fetch messages based on the constructed query and sort them by timestamp in descending order
    const scans = await User.find(query).sort({ timestamp: -1 });

    res.json({ scans });
  } catch (error) {
    console.error('Error fetching User:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// get all register user data
exports.getAllRegisterUser = async (req, res) => {
  const user = req.user; // req.user is set by the authMiddleware
  res.status(200).json({
    success: true,
    user: { secretKey: user.secretKey }
  });
};






