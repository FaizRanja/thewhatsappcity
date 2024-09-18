const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const http = require('http');
const { Server } = require('socket.io');
const QRScan = require('../models/Whatsapp.model');
const Message = require('../models/Message.model');
const Recived = require('../models/Recived.message');
const { app } = require('../app');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promises: fsPromises } = require('fs');
const { setTimeout } = require('timers/promises');

// Initialize Express and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

let allSectionObject = {};
let phoneNumberToIdMap = {};

// Function to remove a directory
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
      await setTimeout(100);
    }
  } catch (error) {
    console.error('Error removing directory:', error);
  }
};

// Function to create a WhatsApp session
const createWhatsappSection = (id, phoneNumber, socket) => {
  if (allSectionObject[id]) {
    console.log(Session already exists for id: ${id});
    return;
  }

  const client = new Client({
    puppeteer: {
      headless: true,
      executablePath: os.platform() === 'win32' ? "C:/Program Files/Google/Chrome/Application/chrome.exe" :
                        os.platform() === 'darwin' ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" :
                        "/usr/bin/google-chrome"
    },
    authStrategy: new LocalAuth({
      clientId: id,
    }),
  });

  // Handle QR code event
  client.on('qr', (qr) => {
    console.log('QR received', qr);
    socket.emit('qr', { qr });
  });

  // Handle client ready event
  client.on('ready', async () => {
    console.log('Client is ready');
    try {
      const phoneNumber = client.info.wid._serialized.split('@')[0];
      const qrScan = await QRScan.findOneAndUpdate(
        { whatsappId: id },
        { status: 'Connected', phoneNumber },
        { new: true, upsert: true }
      );
      io.emit('newQrScan', qrScan);
      socket.emit('ready', { id, message: 'WhatsApp client is ready' });
      phoneNumberToIdMap[phoneNumber] = id;
    } catch (error) {
      console.error('Error saving QR scan data:', error);
      socket.emit('error', { message: 'Error saving QR scan data', error: error.message });
    }
    allSectionObject[id] = client;
  });

  // Handle incoming messages
// Handle incoming messages
client.on('message', async (msg) => {
  console.log('Message received:', msg.body);

  const senderNumber = msg.from.split('@')[0];
  const recipientNumber = msg.to.split('@')[0] || id;

  try {
    // Check if the message is a reply
    const isReply = msg.hasQuotedMsg;
    let replyMessage = null;

    if (isReply) {
      const quotedMsg = await msg.getQuotedMessage();
      replyMessage = quotedMsg.body;

      // Find the original message that was replied to
      const originalMessage = await Message.findOne({
        senderNumber: recipientNumber,
        messageContent: replyMessage,
        status: 'sent'
      });

      if (originalMessage) {
        // Update the original message with the reply
        await Message.findByIdAndUpdate(originalMessage._id, {
          replyMessageContent: replyMessage,
          status: 'replied'
        });
      } else {
        // Handle case where the original message is not found
        console.log('Original message not found for reply');
      }
    }

    const receivedMessage = await Recived.create({
      senderId: recipientNumber,
      recipientNumber,
      senderNumber,
      messageContent: msg.body,
      status: 'received',
      isReply,
      replyMessageContent: replyMessage || null,
    });

    io.emit('replyReceived', {
      senderNumber,
      message: msg.body,
      replyTo: replyMessage,
    });

    socket.emit('messageReceived', { message: receivedMessage });

  } catch (error) {
    console.error('Error saving received message:', error);
    socket.emit('error', { message: 'Error saving received message', error: error.message });
  }
});


  // Handle disconnection event
// Handle disconnection event
client.on('disconnected', async (reason) => {
  console.log('Client disconnected:', reason);
  try {
      if (reason === 'user_logout') {
          console.log('User manually logged out from WhatsApp');
          // Do not trigger QR code regeneration or session cleanup
          return;
      }

      // Handle other disconnection reasons
      const qrScan = await QRScan.findOneAndUpdate(
          { whatsappId: id },
          { status: 'Disconnected' },
          { new: true }
      );

      if (qrScan) {
          io.emit('updateQrScan', qrScan);
      }

      
      delete allSectionObject[id];
      delete phoneNumberToIdMap[client.info.wid.user];
      
      const sessionDir = path.join(__dirname, '.wwebjs_auth', session-${id});
      await removeDirectory(sessionDir);

      socket.emit('disconnected', { message: 'WhatsApp client disconnected', reason });
  } catch (error) {
      console.error('Error updating QR scan status or cleaning up session:', error);
  }
});

  // Handle authentication failure
  client.on('auth_failure', (message) => {
    console.error('Authentication failed:', message);
    socket.emit('error', { message: 'Authentication failed' });
  });

  // Handle client errors
  client.on('error', (error) => {
    console.error('WhatsApp client error:', error);
    socket.emit('error', { message: 'WhatsApp client error', error: error.message });
  });

  // Initialize client
  client.initialize().catch((error) => {
    console.error('Failed to initialize WhatsApp client:', error);
    socket.emit('error', { message: 'Failed to initialize WhatsApp client', error: error.message });
  });
};

// Socket.io event handlers

io.on('connection', (socket) => {
  console.log('User connected', socket.id);

  socket.on('disconnect', async () => {
    console.log('User disconnected', socket.id);
    io.emit('userDisconnected', { socketId: socket.id });
  });

  socket.on('createSection', (data) => {
    const { id, phoneNumber } = data;
    console.log('CreateSection event received for id:', id);
    try {
      createWhatsappSection(id, phoneNumber, socket);
    } catch (error) {
      console.error('Error creating WhatsApp section:', error);
      socket.emit('error', { message: 'Error creating WhatsApp section', error: error.message });
    }
  });

  socket.on('sendMessage', async (data) => {
    const { phoneNumber, number, message, fileType, file } = data;
    console.log('SendMessage received:', data);

    if (!phoneNumber || !number || (!message && !file) || !phoneNumberToIdMap[phoneNumber]) {
      console.error('Invalid input data:', data);
      return socket.emit('messageStatus', { status: 'Failed', error: 'Invalid input data' });
    }

    const formattedNumber = ${number.replace('+', '')}@c.us;
    const id = phoneNumberToIdMap[phoneNumber];
    console.log('Formatted Number:', formattedNumber);

    const client = allSectionObject[id];
    if (client) {
      let newMessage;

      try {
        const senderNumber = client.info.wid.user || id;

        newMessage = await Message.create({
          senderId: id,
          senderNumber,
          recipientNumber: number,
          messageContent: message || 'Media message',
          status: 'waiting'
        });

        if (message) {
          console.log(Sending text message to ${formattedNumber}: ${message});
          await client.sendMessage(formattedNumber, message);
          await Message.findByIdAndUpdate(newMessage._id, { status: 'sent' });
          socket.emit('messageStatus', { status: 'Message sent', senderNumber: phoneNumber, recipientNumber: number });
        } else if (file && fileType) {
          console.log(Sending media file to ${formattedNumber});
          const media = new MessageMedia(fileType, file.toString('base64'), 'file');
          await client.sendMessage(formattedNumber, media);
          await Message.findByIdAndUpdate(newMessage._id, { status: 'sent' });
          socket.emit('messageStatus', { status: 'File sent', senderNumber: phoneNumber, recipientNumber: number });
        } else {
          throw new Error('Invalid input data');
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('messageStatus', { status: 'Failed', error: error.message });
        await Message.findByIdAndUpdate(newMessage._id, { status: 'failed' });
      }
    } else {
      console.error('Client not found for phone number:', phoneNumber);
      socket.emit('messageStatus', { status: 'Failed', error: 'Client not found for phone number' });
    }
  });
});

// Routes for getting all messages
app.get('/api/v1/messages', async (req, res) => {
  try {
    const messages = await Message.find();
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});
// Delete the user from the database
app.delete('/api/v1/qr-scans/:id', async (req, res) => {
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
});

// Delete the Message from the database 
app.delete('/api/v1/messages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Message.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete the Received message from the database 
app.delete('/api/v1/recived/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Recived.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: ' Recived  Message not found' });
    }
    res.status(200).json({ message: 'Recived Message  deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/v1/qr-generate', async (req, res) => {
  const { whatsappId } = req.body;

  if (!whatsappId) {
    return res.status(400).json({ error: 'WhatsApp ID is required' });
  }

  // Check if a session for this WhatsApp ID already exists
  if (allSectionObject[whatsappId]) {
    return res.status(200).json({ message: 'Session already exists for this WhatsApp ID' });
  }

  // Create a new WhatsApp client
  const client = new Client({
    puppeteer: { headless: true },
    authStrategy: new LocalAuth({ clientId: whatsappId }),
  });

  // Listen for the QR event to get the QR code
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
      res.status(500).json({ error: 'Error saving QR scan data' });
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
      io.emit('newQrScan', { whatsappId, status: 'Connected', phoneNumber });
    } catch (error) {
      console.error('Error updating QR scan status:', error);
      res.status(500).json({ error: 'Error updating QR scan status' });
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
    res.status(500).json({ error: 'Authentication failed' });
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
    res.status(500).json({ error: 'WhatsApp client error', details: error.message });
  });

  client.initialize().catch(async (error) => {
    console.error('Failed to initialize WhatsApp client:', error);
    try {
      await QRScan.findOneAndUpdate(
        { whatsappId },
        { status: 'Initialization Failed' },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating QR scan status:', error);
    }
    res.status(500).json({ error: 'Failed to initialize WhatsApp client' });
  });
});

// API route for user logout
app.post('/api/v1/logout', async (req, res) => {
  const { whatsappId } = req.body;

  if (!whatsappId || !allSectionObject[whatsappId]) {
    return res.status(400).json({ error: 'Invalid WhatsApp ID or session not found' });
  }

  const client = allSectionObject[whatsappId];

  try {
    // Perform logout and cleanup operations
    await client.logout(); // Ensure proper logout of the WhatsApp client
    delete allSectionObject[whatsappId]; // Remove client from the active sessions

    // Update the status in the database
    const qrScan = await QRScan.findOneAndUpdate(
      { whatsappId },
      { status: 'Disconnected' },
      { new: true }
    );

    io.emit('updateQrScan', qrScan); // Emit the status update to all clients
    return res.status(200).json({ message: 'Logged out successfully' }); // Ensure this is the only response sent
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ error: 'Failed to log out' }); // Ensure this is only reached on error
  }
});



module.exports = { server };

is code may my chata ho ap socket io ko use na karo os ky bagar mujia all api bana hay to kasy ho ga or hum os qr code ko fortant may kasy use kary gay palse giveme code 

ChatGPT said:
ChatGPT