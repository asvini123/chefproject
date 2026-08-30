const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  tier: {
    type: String,
    enum: ['Free', 'Premium', 'Elite', 'Enterprise', 'Custom'],
    default: 'Custom'
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  billingCycle: {
    type: String,
    enum: ['month', 'year', 'one-time'],
    default: 'month'
  },
  features: [{
    type: String,
    trim: true
  }],
  badge: {
    type: String,
    default: ''
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  activeSubscribers: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Archived'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
