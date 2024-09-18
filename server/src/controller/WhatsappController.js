// Required imports and initializations
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRScan = require('../models/Whatsapp.model');
const Message = require('../models/Message.model');
const Recived = require('../models/Recived.message');
const path = require('path');
const os = require('os');
const { promises: fsPromises } = require('fs');
const AsynicHandler = require('../utils/AsynicHandler');
const User =require ('../models/User.model')
const ApiErrorHandler = require("../utils/ApiError.js");

let allSectionObject = {};
let phoneNumberToIdMap = {};

// Helper function to remove a directory
const removeDirectory = async (dirPath) => {
  try {
    if (await fsPromises.access(dirPath).then(() => true).catch(() => false)) {
      const files = await fsPromises.readdir(dirPath);
      for (const file of files) {
        const curPath = path.join(dirPath, file);
        const stat = await fsPromises.stat(curPath);
        if (stat.isDirectory()) {
          await removeDirectory(curPath);
        } else {
          await fsPromises.unlink(curPath);
        }
      }
      await fsPromises.rmdir(dirPath);
    }
  } catch (error) {
    console.error('Error removing directory:', error);
  }
};


// Create a WhatsApp session
const createWhatsappSection = async (id) => {
  return new Promise((resolve, reject) => {
    // Check if a session already exists
    if (allSectionObject[id]) {
      console.log(`Session already exists for id: ${id}`);
      return resolve({ message: 'Session already exists for this WhatsApp ID' });
    }

    // Initialize the WhatsApp Client
    const client = new Client({
      puppeteer: {
        headless: true,
        executablePath: os.platform() === 'win32' ? "C:/Program Files/Google/Chrome/Application/chrome.exe" :
          os.platform() === 'darwin' ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" :
            "/usr/bin/google-chrome"
      },
      authStrategy: new LocalAuth({ clientId: id }),
    });

    // Timeout to auto-close QR code after 15 seconds if not scanned
    let qrTimeout;

    // Generate QR Code and send it to the frontend
    client.on('qr', async (qr) => {
      console.log('QR Code received:', qr);

      // Check if the session status is "QR Generated" and not connected
      const existingSession = await QRScan.findOne({ whatsappId: id });
      if (existingSession && existingSession.status === 'Connected') {
        console.log('Session already connected, QR code not required');
        return resolve({ message: 'Session is already connected' });
      }
      
      // Set a 15-second timeout to close the QR code if not scanned
      qrTimeout = setTimeout(async () => {
        console.log('QR code expired after 15 seconds, closing session');
       
        client.destroy(); // Destroy client to close session
        delete allSectionObject[id];
      }, 15000); // 15 seconds timeout


      resolve({ message: 'QR Code generated', qrCode: qr });
    });

    // When the client is ready after scanning
    client.on('ready', async () => {
      console.log('Client is ready');
      try {
        clearTimeout(qrTimeout); // Clear QR timeout once connected
        const phoneNumber = client.info.wid._serialized.split('@')[0];
        await QRScan.findOneAndUpdate(
          { whatsappId: id },
          { status: 'Connected', phoneNumber, qrCode: null }, // Clear QR code after connecting
          { new: true, upsert: true }
        );
        phoneNumberToIdMap[phoneNumber] = id;
        allSectionObject[id] = client;
      } catch (error) {
        console.error('Error saving QR scan data:', error);
      }
    });

    // Remaining event handlers (message, disconnected, etc.)
    client.on('message', async (msg) => {
      // Your existing message handling code
    });

    client.on('disconnected', async (reason) => {
      // Your existing disconnected handling code
    });

    client.on('auth_failure', (message) => {
      console.error('Authentication failed:', message);
    });

    client.on('error', (error) => {
      console.error('WhatsApp client error:', error);
    });

    // Initialize the client
    client.initialize().then(() => {
      console.log('WhatsApp client initialized');
    }).catch((error) => {
      console.error('Failed to initialize WhatsApp client:', error);
    });
  });
};



const SendMessage = async (req, res, next) => {
  const { phoneNumber, number, message, fileType, file, secretKey } = req.body;
  const data = { phoneNumber, number, message, fileType, file };
  console.log('SendMessage received:', data);

  // Check if the phone number and other required fields are valid
  if (!phoneNumber || !number || (!message && !file) || !phoneNumberToIdMap[phoneNumber] || !secretKey) {
    console.error('Invalid input data:', data);
    return res.status(400).json({ status: 'Failed', error: 'Invalid input data' });
  }

  // Check if the secret key is valid
  const user = await User.findOne({ secretKey });
  if (!user) {
    return next(new ApiErrorHandler(404, "User not found"));
  }

  // Validate secret key
  const isSecretKeyValid = user.validateSecretKey(secretKey);
  if (!isSecretKeyValid) {
    return next(new ApiErrorHandler(401, "Invalid secret key"));
  }

  // Format the phone number for WhatsApp
  const formattedNumber = `${number.replace('+', '')}@c.us`;
  const id = phoneNumberToIdMap[phoneNumber]; // Retrieve client ID associated with the phone number
  console.log('Formatted Number:', formattedNumber);

  // Get the WhatsApp client from the stored sessions
  const client = allSectionObject[id];
  if (!client) {
    console.error('Client not found for phone number:', phoneNumber);
    return res.status(404).json({ status: 'Failed', error: 'Client not found for phone number' });
  }

  try {
    // Extract sender number from client or use the provided ID
    const senderNumber = client.info.wid.user || id;

    // Create a new message record in the database with 'waiting' status
    const newMessage = await Message.create({
      senderId: id,
      senderNumber,
      recipientNumber: number,
      messageContent: message || 'Media message',
      status: 'waiting',
    });

    // Handle sending text messages
    if (message) {
      console.log(`Sending text message to ${formattedNumber}: ${message}`);
      await client.sendMessage(formattedNumber, message);
      await Message.findByIdAndUpdate(newMessage._id, { status: 'sent' });
      return res.status(200).json({ status: 'Message sent', senderNumber: phoneNumber, recipientNumber: number });
    }

    // Handle sending media files
    if (file && fileType) {
      console.log(`Sending media file to ${formattedNumber}`);
      const media = new MessageMedia(fileType, file.toString('base64'), 'file');
      await client.sendMessage(formattedNumber, media);
      await Message.findByIdAndUpdate(newMessage._id, { status: 'sent' });
      return res.status(200).json({ status: 'File sent', senderNumber: phoneNumber, recipientNumber: number });
    }

    // If no valid input, throw an error
    throw new Error('Invalid input data');
  } catch (error) {
    console.error('Error sending message:', error);
    if (newMessage) {
      await Message.findByIdAndUpdate(newMessage._id, { status: 'failed' });
    }
    return res.status(500).json({ status: 'Failed', error: error.message });
  }
};




// Function for relink Whatsapp Account
const    generateCodeforRelink = AsynicHandler(async (req,res,next)=>{
  const { whatsappId } = req.body;

  if (!whatsappId) {
    return res.status(400).json({ error: 'WhatsApp ID is required' });
  }

  if (allSectionObject[whatsappId]) {
    return res.status(200).json({ message: 'Session already exists for this WhatsApp ID' });
  }

  const client = new Client({
    puppeteer: { headless: true }, 
    authStrategy: new LocalAuth({ clientId: whatsappId }),
  });

  client.on('qr', async (qr) => {
    console.log('QR code generated:', qr);
    try {
      await QRScan.findOneAndUpdate(
        { whatsappId },
        { status: 'Awaiting Scan' },
        { new: true, upsert: true }
      );
      res.status(200).json({ qrCode: qr });
    } catch (error) {
      console.error('Error saving QR scan data:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Error saving QR scan data' });
    }
  });

  client.on('ready', async () => {
    console.log('Client is ready');
    try {
      const phoneNumber = client.info.wid._serialized.split('@')[0];
      await QRScan.findOneAndUpdate(
        { whatsappId },
        { status: 'Connected', phoneNumber },
        { new: true }
      );
      allSectionObject[whatsappId] = client;
    } catch (error) {
      console.error('Error updating QR scan status:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Error updating QR scan status' });
    }
  });

  client.on('auth_failure', async (message) => {
    console.error('Authentication failed:', message);
    try {
      await QRScan.findOneAndUpdate(
        { whatsappId },
        { status: 'Auth Failure' },
        { new: true }
      );

      
    } catch (error) {
      console.error('Error updating QR scan status:', error);
    }
    if (!res.headersSent) res.status(500).json({ error: 'Authentication failed' });
  });

  client.on('error', async (error) => {
    console.error('WhatsApp client error:', error);
    try {
      await QRScan.findOneAndUpdate(
        { whatsappId },
        { status: 'Error' },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating QR scan status:', error);
    }
    if (!res.headersSent) res.status(500).json({ error: 'WhatsApp client error' });
  });

  try {
    await client.initialize();
  } catch (error) {
    console.error('Failed to initialize WhatsApp client:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to initialize WhatsApp client' });
  }
})




module.exports = { createWhatsappSection ,SendMessage ,generateCodeforRelink };

// Endpoint to handle section creation and return QR code

