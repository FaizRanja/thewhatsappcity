const mongoose = require('mongoose');

const qrScanSchema = new mongoose.Schema({
  whatsappId: {
    type: String,
    required: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['Connected', 'Disconnected'],
    default: 'Connected',
  },
  scannedAt: {
    type: Date,
    default: Date.now,
  },
});

const QRScan = mongoose.model('QRScan', qrScanSchema);

module.exports = QRScan;
