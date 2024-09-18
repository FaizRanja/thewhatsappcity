const Message = require('../models/Message.model');
const Recived = require('../models/Recived.message');
const QRScan = require('../models/Whatsapp.model');
const AsynicHandler = require('../utils/AsynicHandler');
const apifeatucher = require('../utils/Search'); // Import your ApiFeature utility
const { createWhatsappSection } = require('./WhatsappController');
const User = require('../models/User.model');

const { phoneNumberToIdMap, allSectionObject } = require('./WhatsappController'); // Ensure correct import path

// Get all user accounts when the QR code is scanned
exports.getAllData = AsynicHandler(async (req, res) => {
    try {
      // Initialize API feature with filtering and search functionality
      const apiFeature = new apifeatucher(QRScan.find(), req.query)
        .Search()
        .filter();
  
      // Sort the data by the 'createdAt' field in descending order (latest first)
      const scans = await apiFeature.query.sort({ createdAt: -1 });
  
      // Send the response with the retrieved data
      res.status(200).json({
        success: true,
        scans,
      });
    } catch (error) {
      console.error('Error retrieving QR scans:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
// Refresh All Data
  exports.Refreshdata=AsynicHandler(async(req,res,next)=>{
    try {
      // Fetch fresh data
      const freshData = await QRScan();
      // Update the cache or database with the fresh data
      dataCache = freshData;
  
      // Send a success response
      res.status(200).json({ message: 'Data refreshed successfully', data: dataCache });
    } catch (error) {
      console.error('Error refreshing data:', error);
      res.status(500).json({ message: 'Failed to refresh data', error: error.message });
    }
  })
// Get alll Messages
  exports.getmessage = AsynicHandler(async (req, res, next) => {
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
      const scans = await Message.find(query).sort({ timestamp: -1 });
  
      res.json({ scans });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all Recived MEsssage
exports.getRecivedmessage= AsynicHandler(async (req, res, next) => {
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

      // Fetch messages based on the constructed query
      const scans = await Recived.find(query).sort({ timestamp: -1 });
      res.json({ scans });
  } catch (error) {
      console.error('Error retrieving messages:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

// Get Total User I mean All User are store in database
exports.getLoginUser=AsynicHandler(async(req,res,next)=>{
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
// Get all  send  Message in Your Database i mean all Total message are store 
    exports.sentmessage=AsynicHandler(async(req,res,next)=>{
        try {
          const usercount=await Message.countDocuments()
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
// Get all  Recived  Message in Your Database i mean all Total message are store 
        exports.recivedmessage=AsynicHandler(async(req,res,next)=>{
            try {
              const usercount=await Recived.countDocuments()
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
// // Get all Qr Scan  Message in Your Database i mean all Total message are store 
            exports.getQrScan=AsynicHandler(async(req,res,next)=>{
                try {
                  const usercount=await QRScan.countDocuments()
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
// Create Section for Qernate Qr code 
exports.CreateSection = async (req, res, next) => { // Added next here
  const { id, secretKey } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }
  if (!secretKey) {
    return res.status(400).json({ error: 'Secret key is required' });
  }
  
  try {
    // Check if the secret key is valid and belongs to the user
    const user = await User.findOne({ secretKey });

    if (!user) {
      return next(new ApiErrorHandler(400, "User not found")); // Pass error to next
    }

    const isSecretKeyValid = user.validateSecretKey(secretKey);
    if (!isSecretKeyValid) {
      return next(new ApiErrorHandler(401, "Your secret key does not match")); // Pass error to next
    }

    // Create the WhatsApp section and get the QR code
    const response = await createWhatsappSection(id);

    // Send the QR code to the frontend
    res.status(200).json({ message: response.message, qrCode: response.qrCode });
  } catch (error) {
    console.error('Error creating WhatsApp section:', error);
    next(new ApiErrorHandler(500, 'Failed to create WhatsApp section')); // Pass error to next
  }
};

// API to log out a session
exports.sectionLogout=AsynicHandler(async (req,res,next)=>{
  const { whatsappId } = req.body;

  if (!whatsappId) {
    return res.status(400).json({ error: 'WhatsApp ID is required' });
  }

  const client = allSectionObject[whatsappId];
  if (!client) {
    return res.status(400).json({ error: 'WhatsApp client not found for the provided ID' });
  }

  try {
    await client.logout();
    const sessionDir = path.join(__dirname, '.wwebjs_auth', `session-${whatsappId}`);
    await removeDirectory(sessionDir);
    delete allSectionObject[whatsappId];
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error logging out client:', error);
    res.status(500).json({ error: 'Failed to log out client' });
  }
})
// Function for qr scan Data Gelete 
exports.DeleteQrScan=AsynicHandler(async(req,res,next)=>{
  const { id } = req.params;
  try {
    const result = await QRScan.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'QR scan not found' });
    }
    res.status(200).json({ message: 'QR scan deleted successfully' });
  } catch (error) {
    console.error('Error deleting QR scan:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
// Function For Delete send message
exports.DeleteSentMessage=AsynicHandler(async(req,res,next)=>{
  const { id } = req.params;
  try {
    const result = await Message.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'Send Message not found' });
    }
    res.status(200).json({ message: 'Sent Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting QR scan:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
// Function For Delete Recived message
exports.DeleteRecivedMessage=AsynicHandler(async(req,res,next)=>{
  const { id } = req.params;
  try {
    const result = await Recived.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'Recived message not found' });
    }
    res.status(200).json({ message: 'Recived  Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting QR scan:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})













