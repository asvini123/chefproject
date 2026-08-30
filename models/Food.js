const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  name: {
    type: String,
    required: true
  },
  cuisine: {
    type: String,
    required: true
  },
  category: { type: String, default: "Main Course" },
  servingSize: { type: String, default: "1 serving" },
  description: { type: String, default: "A delicious and authentic dish." },
  spiceLevel: { type: Number, default: 2 }, // 1 to 5
  images: [{
    type: String
  }],
  calories: {
    type: String,
    default: "350 kcal"
  },
  nutrition: {
    protein: { type: String, default: "20 g" },
    carbs: { type: String, default: "40 g" },
    fat: { type: String, default: "15 g" },
    saturatedFat: { type: String, default: "5 g" },
    fiber: { type: String, default: "3 g" },
    sugar: { type: String, default: "5 g" },
    cholesterol: { type: String, default: "50 mg" },
    sodium: { type: String, default: "500 mg" }
  },
  ingredients: [{
    type: String
  }],
  allergens: [{ type: String }],
  dietaryInfo: [{ type: String }],
  prepTime: {
    preparation: { type: String, default: "15 mins" },
    marination: { type: String, default: "0 mins" },
    cooking: { type: String, default: "20 mins" },
    total: { type: String, default: "35 mins" }
  },
  healthTips: [{ type: String }],
  suitableFor: [{ type: String }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Food', foodSchema);
