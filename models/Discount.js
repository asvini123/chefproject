const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  type: {
    type: String,
    enum: ['Festival', 'Coupon', 'Seasonal', 'Referral'],
    default: 'Festival'
  },
  validTill: {
    type: Date,
    required: true
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Disabled'],
    default: 'Active'
  },
  usedCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Discount', discountSchema);
