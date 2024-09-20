const express = require("express");
const {
  getAllData,
  getmessage,
  getRecivedmessage,
  sentmessage,
  recivedmessage,
  getQrScan,
  Refreshdata,
  CreateSection,
  DeleteQrScan,
  DeleteSentMessage,
  DeleteRecivedMessage,
} = require("../controller/WhatsappAllData");
const { SendMessage, generateCodeforRelink } = require("../controller/WhatsappController");
const { isAuthenticated } = require("../middleware/auth");

const router = express.Router();

router.route("/user").get(  getAllData);
router.route("/user/message").get(  getmessage);
router.route("/user/recived").get( getRecivedmessage);
router.route("/user/sentmessage").get(sentmessage);
router.route("/user/recivedmessage").get(  recivedmessage);
router.route("/user/QrDta").get(  getQrScan);
router.route("/user/refreshdata").get(Refreshdata);
router.route("/user/createsection").post(   CreateSection);
router.route("/user/generatecode/relink").post(   generateCodeforRelink); // Fixed typo here
router.route("/:id").delete(  DeleteQrScan);
router.route("/user/sendmessage").post(  SendMessage);
router.route("/user/delete/sentmessage/:id").delete(  DeleteSentMessage);
router.route("/user/delete/recivedmessage/:id").delete( DeleteRecivedMessage);

module.exports = router;
