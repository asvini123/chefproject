const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'chef', 'admin'],
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  district: {
    type: String,
    default: ''
  },
  province: {
    type: String,
    default: ''
  },
  postalCode: {
    type: String,
    default: ''
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  
  // User-specific fields
  healthCondition: {
    type: String,
    default: ''
  },
  allergies: {
    type: String,
    default: ''
  },
  userPurpose: {
    type: String,
    default: ''
  },
  savedChefs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  subscriptionTier: {
    type: String,
    enum: ['Free', 'Premium', 'Elite'],
    default: 'Free'
  },
  urgentBookingsLeft: {
    type: Number,
    default: 0
  },
  hasFreeCourseEnrollment: {
    type: Boolean,
    default: false
  },

  // Chef-specific fields
  chefType: {
    type: String,
    default: ''
  },
  experience: {
    type: Number,
    default: 0
  },
  cuisines: {
    type: [String],
    default: []
  },
  hourlyRate: {
    type: Number,
    default: 0
  },
  bio: {
    type: String,
    default: ''
  },
  nic: {
    type: String,
    default: ''
  },
  nicFront: {
    type: String,
    default: ''
  },
  nicBack: {
    type: String,
    default: ''
  },
  policeClearance: {
    type: String,
    default: ''
  },
  certificates: {
    type: [String],
    default: []
  },
  bankName: {
    type: String,
    default: ''
  },
  accountHolderName: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: ''
  },
  chefPurpose: {
    type: [String],
    default: []
  },
  // Availability & Working Hours
  availability: {
    weekdays: {
      mon: { type: String, default: 'available' },
      tue: { type: String, default: 'available' },
      wed: { type: String, default: 'available' },
      thu: { type: String, default: 'available' },
      fri: { type: String, default: 'available' },
      sat: { type: String, default: 'available' },
      sun: { type: String, default: 'available' }
    },
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '19:00' }
    },
    vacations: [{
      startDate: { type: Date },
      endDate: { type: Date },
      note: { type: String, default: 'Vacation / Leave' }
    }]
  },

  // Pricing & Surcharges
  pricingSettings: {
    guestTier1to5: { type: Number, default: 3000 },
    guestTier6to10: { type: Number, default: 5000 },
    guestTier11to20: { type: Number, default: 8000 },
    urgentMarkup: { type: Number, default: 25 },
    christmasMarkup: { type: Number, default: 15 },
    newYearMarkup: { type: Number, default: 20 }
  },

  isApproved: {
    type: Boolean,
    default: false // Chefs need Admin approval to log in
  },

  profileVisibility: {
    type: String,
    enum: ['Public', 'Private'],
    default: 'Public'
  },

  notificationPreferences: {
    emailAlerts: { type: Boolean, default: true },
    smsAlerts: { type: Boolean, default: true }
  },

  memberId: {
    type: String,
    sparse: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);