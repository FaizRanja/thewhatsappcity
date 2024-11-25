const { app } = require("./app");
const Databaseconnec = require("./Db/Dbconnection");
const dotenv = require("dotenv");

dotenv.config();

const port = process.env.PORT || 3001;

Databaseconnec()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to database:", error);
    process.exit(1);
  });
