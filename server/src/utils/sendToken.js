// Define and export the function
const sendToken = (user, statusCode, res, secretKey) => {
// Define and export the function
  const token = user.getJWTToken(); // Generate the token (ensure this is correctly implemented in your model)
  
  const cookieExpireDays = process.env.COOKIE_EXPIRE ? parseInt(process.env.COOKIE_EXPIRE) : 7; // Default expiry of 7 days
  
  // Cookie options
  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000), // Set expiration
    httpOnly: true, // Make cookie httpOnly for security
    secure: process.env.NODE_ENV === "production", // Use secure flag in production
    sameSite: 'Lax' // Prevent CSRF attacks
  };

  // Set the cookie and respond with user data
  res.status(statusCode)
    .cookie('token', token, options) // Set the token in cookies
    .json({
      success: true,
      user,
      token ,// Optionally send the token in the response body (for client-side storage, if needed),
      secretKey

    });
};



module.exports = sendToken; // Export the function
