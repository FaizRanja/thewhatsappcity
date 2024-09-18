const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true }, // ID of the sender
  senderNumber: { type: String, required: true }, // Phone number of the sender
  recipientNumber: { type: String, required: true }, // Phone number of the recipient
  messageContent: { type: String, required: true }, // Content of the message
  status: { type: String, enum: ['waiting', 'sent', 'received', 'failed'], default: 'waiting' },
  timestamp: { type: Date, default: Date.now },
  API: { type: String, default: 'no' }
   // Status of the message
});


const Recived = mongoose.model('Recived', messageSchema);

module.exports = Recived;
