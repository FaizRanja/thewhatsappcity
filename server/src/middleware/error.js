const Errorhandler=require("../utils/ErrorHandler")


module.exports=(err,req,res,next)=>{
 err.statusCode=err.statusCode || 500;
   err.message=err.message ||"interna server Error"

// wrong Mongodb Error
if (err.name === "CastError") {
  const message = `Resource not found. Invalid: ${err.path}`;
  err = new Errorhandler(message, 400);
}


// Mongoose Dublate Key error
if (err.code === 11000) {
  const message =`Duplicate ${Object.keys(err.keyValue)} Entered`
  err=new Errorhandler(message,400)
}
// wrong json WebToken Error
if (err.name === "jsonWebTokenError") {
  const message =`Json web token is invalid, please try again`;
  err = new Errorhandler(message, 400);
}

// wrong json Expire token Error
if (err.name === "TokenExpireError") {
  const message =`Json web token is Expire, please try again`;
  err = new Errorhandler(message, 400);
}

   res.status(err.statusCode).json({
    success:false,
    message:err.message 
   });
};