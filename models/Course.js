const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['cuisine', 'skill', 'health', 'occasion', 'certification'],
    default: 'cuisine'
  },
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cuisineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuisine',
    required: false
  },
  duration: {
    type: String,
    default: '2 hours'
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Live', 'Pending', 'Rejected'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', courseSchema);
