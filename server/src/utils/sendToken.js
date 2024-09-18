// Define and export the function
const sendToken = (user, statusCode, res, secretKey) => {
  const token = user.getJWTToken();
  const cookieExpireDays = process.env.COOKIE_EXPIRE ? parseInt(process.env.COOKIE_EXPIRE) : 7;
  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
  };
  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    user,
    token,
    secretKey
  });
};

module.exports = sendToken; // Export the function
