const AsynicHandler=(requsthandler)=>{ 
    return (req,res,next) => {
      Promise.resolve(requsthandler(req,res,next)).catch((error)=>{
          next(error);
      })
  }
  }
  module .exports =AsynicHandler
  
  
  