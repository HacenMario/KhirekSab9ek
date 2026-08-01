const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  foodType: { type: String, required: true },
  quantity: { type: Number, required: true },
  locationName: { type: String, required: true },
  expiryTime: { type: Date, required: true },
  temp: { type: String, enum: ['hot', 'cold'], default: 'hot' },
  size: { type: String, enum: ['bike', 'car'], default: 'bike' },
  coords: { lat: Number, lng: Number },
  status: { type: String, enum: ['available', 'claimed', 'expired'], default: 'available' },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donorName: String,
  donorPhone: String,
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claimedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ad', adSchema);