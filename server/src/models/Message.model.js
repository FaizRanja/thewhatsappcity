const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderNumber: { type: String, required: false }, // Optional sender's number
  recipientNumber: { type: String, required: true }, // Recipient's number
  messageContent: { type: String, required: true }, // Message content
  status: { type: String, enum: ['waiting', 'sent', 'failed'], default: 'waiting' }, // Message status
  timestamp: { type: Date, default: Date.now }, // Timestamp when the message was created
  API: { type: String, default: 'no' } // API field with default value "no"
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
