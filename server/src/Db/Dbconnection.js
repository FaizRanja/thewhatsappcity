const mongoose  = require("mongoose");
// const { dbname }= require ( "../constant.js");

const Databaseconnec=async ()=>{
    try {
        const connection =await mongoose.connect(`${process.env.MONGOOSE_CONNECTION}`)
console.log("mongoose connection is successfully")
    } catch (error) {
        console.log("mongoose connection error" + error)
        process.exit(1);
    }
}

module.exports = Databaseconnec;





