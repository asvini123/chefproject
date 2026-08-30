const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    default: ''
  },
  chefName: {
    type: String,
    default: ''
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Card', 'Cash', 'Wallet', 'Bank Transfer', 'PayHere', 'Payhere', 'Online', 'PayHere (Credit/Debit Card)', 'Cash on Delivery', 'Credit/Debit Card'],
    default: 'PayHere'
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed', 'Completed'],
    default: 'Paid'
  },
  receiptFileUrl: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Receipt', receiptSchema);
