const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingType: {
    type: String,
    enum: ['Daily', 'Urgent', 'Event', 'Subscription'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in hours
    required: true
  },
  location: {
    type: String,
    required: true
  },
  locationMapUrl: {
    type: String,
    default: ''
  },
  landmarkNotes: {
    type: String,
    default: ''
  },
  locationType: {
    type: String,
    enum: ['Apartment', 'House', 'Venue'],
    default: 'House'
  },
  // Event-specific details
  eventName: {
    type: String,
    default: ''
  },
  eventVenue: {
    type: String,
    default: ''
  },
  eventStartTime: {
    type: String,
    default: ''
  },
  eventEndTime: {
    type: String,
    default: ''
  },
  foodName: {
    type: String,
    default: ''
  },
  cuisine: {
    type: String,
    default: ''
  },
  menu: [{
    type: String
  }],
  mealSession: [{
    type: String
  }],
  availableIngredients: {
    type: String,
    default: ''
  },
  grocerySupport: {
    type: Boolean,
    default: false
  },
  groceryItemsNeeded: {
    type: String,
    default: ''
  },
  groceryApprovalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'None'],
    default: 'None'
  },
  dietaryPreference: {
    type: String,
    enum: ['Diabetic-friendly', 'None'],
    default: 'None'
  },
  allergyDetails: {
    type: String,
    default: ''
  },
  guests: {
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 }
  },
  
  // Pricing breakdowns
  baseRate: { type: Number, default: 0 },
  guestSurcharge: { type: Number, default: 0 },
  mealCharge: { type: Number, default: 0 },
  groceryCharge: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Chef estimates
  cookingTimeEstimate: {
    type: String,
    default: ''
  },
  extraIngredients: {
    type: String,
    default: ''
  },

  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Wallet', 'Bank Transfer', 'Bank', 'PayHere', 'Bank Deposit', 'Cash on Delivery', 'Credit/Debit Card', 'PayHere (Credit/Debit Card)'],
    default: 'Bank Transfer'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Deposit Paid', 'Completed', 'Refunded'],
    default: 'Pending'
  },
  halfPaymentAmount: {
    type: Number,
    default: 0
  },
  halfPaymentPaid: {
    type: Boolean,
    default: false
  },
  bankReceiptUrl: {
    type: String,
    default: null
  },
  bankReceiptUploadedAt: {
    type: Date,
    default: null
  },
  bankReceiptReference: {
    type: String,
    default: ''
  },
  bankReceiptVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Deposit Paid', 'On the way', 'Cooking', 'Processing', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  cashCollectedAmount: {
    type: Number,
    default: 0
  },
  collectedByChefName: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    default: ''
  },
  cookingStartedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  cancelledBy: {
    type: String,
    default: ''
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);
