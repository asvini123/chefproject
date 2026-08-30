const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false
  },
  courseTitle: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'Cuisine'
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  learningMode: {
    type: String,
    enum: ['In-Person Kitchen Class', 'Online Live Masterclass', 'Weekend Workshop', 'Self-Paced'],
    default: 'In-Person Kitchen Class'
  },
  preferredDate: {
    type: Date,
    default: null
  },
  preferredTime: {
    type: String,
    default: 'Morning (09:00 AM - 12:00 PM)'
  },
  dietaryPreference: {
    type: String,
    default: 'None'
  },
  specialNotes: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash on Session', 'Card / Online', 'Free Credit / Subscription', 'Bank Transfer'],
    default: 'Cash on Session'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Free'],
    default: 'Pending'
  },
  status: {
    type: String,
    enum: ['Enrolled', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Enrolled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
