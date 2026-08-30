require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Course = require('./models/Course');
const Food = require('./models/Food');

mongoose.connect('mongodb://localhost:27017/chefnest').then(async () => {
  console.log('Connected to MongoDB for seeding...');
  
  // Find a verified chef
  const chef = await User.findOne({ role: 'chef', isApproved: true });
  if (!chef) {
    console.error('No approved chef found to link courses to! Please register or approve a chef first.');
    process.exit(1);
  }
  const chefId = chef._id;

  // Clear existing courses and foods to make it clean
  await Course.deleteMany({});
  await Food.deleteMany({});

  // Seed 6 premium/free courses
  const coursesToSeed = [
    { title: 'Italian Pasta & Sauce Masterclass', duration: '3 hours', price: 4500, status: 'Live', chefId },
    { title: 'Traditional Sri Lankan Rice & Curry', duration: '4 hours', price: 0, status: 'Live', chefId },
    { title: 'French Pastry & Baking Basics', duration: '2.5 hours', price: 6000, status: 'Live', chefId },
    { title: 'Vegan & Gluten-Free Meal Prep', duration: '2 hours', price: 3500, status: 'Live', chefId },
    { title: 'South Indian Dosa & Sambar Secrets', duration: '3 hours', price: 0, status: 'Live', chefId },
    { title: 'Sushi Rolling & Sashimi Artistry', duration: '3.5 hours', price: 7500, status: 'Live', chefId }
  ];

  await Course.insertMany(coursesToSeed);
  console.log('Seeded 6 cooking courses successfully!');

  // Seed 12 food items for ingredient suggestion
  const foodsToSeed = [
    {
      name: 'Egg Fried Rice',
      cuisine: 'Chinese',
      category: 'Main Course',
      description: 'Quick and tasty stir-fried rice with eggs, green onions, and soy sauce.',
      ingredients: ['rice', 'egg', 'onion', 'garlic', 'soy sauce', 'oil'],
      calories: '380 kcal',
      spiceLevel: 1
    },
    {
      name: 'Tomato & Garlic Pasta',
      cuisine: 'Italian',
      category: 'Main Course',
      description: 'Simple spaghetti tossed in a rich garlic-infused tomato sauce.',
      ingredients: ['pasta', 'tomato', 'garlic', 'olive oil', 'basil'],
      calories: '320 kcal',
      spiceLevel: 1
    },
    {
      name: 'Chicken Curry',
      cuisine: 'Sri Lankan',
      category: 'Main Course',
      description: 'A aromatic, spicy chicken curry made with rich coconut milk.',
      ingredients: ['chicken', 'coconut milk', 'curry powder', 'onion', 'garlic', 'chili'],
      calories: '450 kcal',
      spiceLevel: 4
    },
    {
      name: 'Tomato Omelette',
      cuisine: 'Western',
      category: 'Breakfast',
      description: 'Fluffy eggs cooked with fresh chopped tomatoes, onions, and black pepper.',
      ingredients: ['egg', 'tomato', 'onion', 'pepper', 'butter'],
      calories: '180 kcal',
      spiceLevel: 2
    },
    {
      name: 'Garlic Rice with Fried Egg',
      cuisine: 'Asian',
      category: 'Breakfast',
      description: 'Garlicky fried rice topped with a perfectly crispy sunny-side-up egg.',
      ingredients: ['rice', 'garlic', 'egg', 'oil', 'soy sauce'],
      calories: '350 kcal',
      spiceLevel: 1
    },
    {
      name: 'Spicy Garlic Chicken',
      cuisine: 'Asian',
      category: 'Main Course',
      description: 'Crispy chicken pieces tossed in a sweet, sticky, and spicy garlic chili sauce.',
      ingredients: ['chicken', 'garlic', 'chili', 'soy sauce', 'honey', 'oil'],
      calories: '490 kcal',
      spiceLevel: 3
    }
  ];

  await Food.insertMany(foodsToSeed);
  console.log('Seeded 6 recipe/food items successfully!');

  mongoose.disconnect();
}).catch(console.error);
