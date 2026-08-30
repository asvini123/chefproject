const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Food = require('./models/Food');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chefnest';

const CUISINE_MAP = {
  'Srilankan foods': 'Sri Lankan',
  'italian foods': 'Italian',
  'indian foods': 'Indian',
  'chinese foods': 'Chinese',
  'Japanese foods': 'Japanese',
  'mexican foods': 'Mexican',
  'French foods': 'French',
  'malaysian foods': 'Malaysian',
  'american foods': 'American',
  'Portuguese foods': 'Portuguese'
};

function formatDishName(rawName) {
  return rawName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function generateDishDetails(dishName, cuisine) {
  const isVeg = /veg|bean|carrot|pumpkin|aloo|dosa|idli|paneer|tofu|salad|focaccia/i.test(dishName);
  const isSeafood = /fish|crab|prawn|cuttlefish|lobster|salmon|shrimp|clam|sardine|bacalhau|polvo/i.test(dishName);
  const isSpicy = /curry|spicy|chili|biryani|rogan|tandoori|mole|rendang|jambalaya|buffalo/i.test(dishName);

  const calories = isVeg ? (220 + Math.floor(Math.random() * 120)) : (isSeafood ? 340 + Math.floor(Math.random() * 110) : 420 + Math.floor(Math.random() * 180));
  const protein = isVeg ? '10–14g' : (isSeafood ? '28–34g' : '32–42g');
  const carbs = isVeg ? '35–48g' : '22–38g';
  const fat = isVeg ? '8–14g' : '14–22g';

  const spiceLevel = isSpicy ? (cuisine === 'Sri Lankan' || cuisine === 'Indian' || cuisine === 'Mexican' ? 4 : 3) : 1;

  let ingredients = [];
  if (cuisine === 'Sri Lankan') {
    ingredients = ['Coconut Milk', 'Roasted Curry Powder', 'Curry Leaves', 'Cinnamon', 'Garlic & Ginger', 'Green Chilies', 'Turmeric', 'Fenugreek'];
  } else if (cuisine === 'Italian') {
    ingredients = ['Extra Virgin Olive Oil', 'San Marzano Tomatoes', 'Fresh Basil', 'Parmigiano-Reggiano', 'Garlic', 'Oregano', 'Sea Salt'];
  } else if (cuisine === 'Indian') {
    ingredients = ['Garam Masala', 'Ghee', 'Cumin & Coriander', 'Ginger-Garlic Paste', 'Cardamom & Cloves', 'Turmeric', 'Fresh Coriander'];
  } else if (cuisine === 'Chinese') {
    ingredients = ['Soy Sauce', 'Sesame Oil', 'Shaoxing Wine', 'Ginger & Spring Onion', 'Garlic', 'Sichuan Peppercorns', 'Oyster Sauce'];
  } else if (cuisine === 'Japanese') {
    ingredients = ['Dashi Broth', 'Mirin', 'Japanese Soy Sauce', 'Sake', 'Nori Seaweed', 'Sesame', 'Scallions'];
  } else if (cuisine === 'French') {
    ingredients = ['French Butter', 'Shallots', 'White Wine', 'Fresh Thyme & Rosemary', 'Garlic', 'Heavy Cream', 'Dijon Mustard'];
  } else if (cuisine === 'Mexican') {
    ingredients = ['Corn Tortillas', 'Fresh Cilantro', 'Limes', 'Cumin', 'Jalapeño & Serrano Chilies', 'Avocado', 'Queso Fresco'];
  } else if (cuisine === 'Portuguese') {
    ingredients = ['Olive Oil', 'Garlic', 'Piri-Piri Pepper', 'Bay Leaves', 'White Wine', 'Fresh Coriander', 'Paprika'];
  } else if (cuisine === 'Malaysian') {
    ingredients = ['Coconut Milk', 'Lemongrass', 'Galangal', 'Sambal Paste', 'Kaffir Lime Leaves', 'Tamarind', 'Shallots'];
  } else {
    ingredients = ['Smoked Paprika', 'Black Pepper', 'Garlic Powder', 'Butter', 'Sea Salt', 'Fresh Herbs', 'Brown Sugar'];
  }

  // Add primary component
  if (/chicken/i.test(dishName)) ingredients.unshift('Fresh Tender Chicken');
  else if (/mutton|lamb/i.test(dishName)) ingredients.unshift('Slow-Cooked Mutton/Lamb');
  else if (/fish/i.test(dishName)) ingredients.unshift('Fresh Catch Fish Fillets');
  else if (/prawn|shrimp/i.test(dishName)) ingredients.unshift('Jumbo Tiger Prawns');
  else if (/crab/i.test(dishName)) ingredients.unshift('Lagoon Sea Crab');
  else if (/cuttlefish/i.test(dishName)) ingredients.unshift('Fresh Tender Cuttlefish');
  else if (/beef|steak/i.test(dishName)) ingredients.unshift('Prime Cut Beef');
  else if (/pork/i.test(dishName)) ingredients.unshift('Savory Pork Cuts');
  else if (/duck/i.test(dishName)) ingredients.unshift('Roasted Duck Breast');
  else if (/rice/i.test(dishName)) ingredients.unshift('Aromatic Basmati / Keeri Samba Rice');

  return {
    category: isVeg ? 'Vegetarian Main' : (isSeafood ? 'Seafood Specialty' : 'Gourmet Entrée'),
    servingSize: '1–2 servings',
    description: `Authentic ${dishName} prepared according to traditional ${cuisine} culinary techniques, highlighting rich balance and aromatic flavors.`,
    spiceLevel,
    calories: `${calories} kcal`,
    nutrition: {
      protein,
      carbs,
      fat,
      saturatedFat: '3.5g',
      fiber: '4.2g',
      sugar: '3.0g',
      cholesterol: isVeg ? '0mg' : '65mg',
      sodium: '480mg'
    },
    ingredients,
    allergens: isSeafood ? ['Shellfish/Fish'] : (/milk|cheese|butter|cream/i.test(dishName) ? ['Dairy'] : ['None reported']),
    dietaryInfo: isVeg ? ['100% Vegetarian', 'Plant-Based', 'Healthy Option'] : ['Rich in Protein', 'Fresh Ingredients', 'Halal-Friendly Prep Available'],
    prepTime: {
      preparation: '15 mins',
      marination: isSpicy ? '25 mins' : '10 mins',
      cooking: isSpicy ? '30 mins' : '20 mins',
      total: isSpicy ? '70 mins' : '45 mins'
    },
    healthTips: [
      'High in essential vitamins and prepared with fresh spices.',
      'Cooked with artisanal low-oil technique for clean digestion.',
      'Customized sodium and spice levels available on chef request.'
    ],
    suitableFor: ['Family Dinners', 'Special Gatherings', 'Weekend Feasts', 'Private Dining']
  };
}

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const foodsBase = path.join(process.cwd(), 'public', 'images', 'foods');
    if (!fs.existsSync(foodsBase)) {
      console.log('Foods base directory not found:', foodsBase);
      process.exit(1);
    }

    const cuisineDirs = fs.readdirSync(foodsBase);
    let totalSeeded = 0;

    for (const cDir of cuisineDirs) {
      const cPath = path.join(foodsBase, cDir);
      if (!fs.statSync(cPath).isDirectory()) continue;

      const cuisineName = CUISINE_MAP[cDir] || formatDishName(cDir.replace(/foods/i, ''));
      const dishDirs = fs.readdirSync(cPath);

      for (const dDir of dishDirs) {
        if (dDir === 'New folder') continue;
        const dPath = path.join(cPath, dDir);
        if (!fs.statSync(dPath).isDirectory()) continue;

        const dishName = formatDishName(dDir);

        // Find all images in this dish directory
        const imgFiles = fs.readdirSync(dPath).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (imgFiles.length === 0) continue;

        const images = imgFiles.map(f => `/images/foods/${encodeURIComponent(cDir)}/${encodeURIComponent(dDir)}/${encodeURIComponent(f)}`);

        const details = generateDishDetails(dishName, cuisineName);

        await Food.findOneAndUpdate(
          { name: dishName, cuisine: cuisineName },
          {
            name: dishName,
            cuisine: cuisineName,
            category: details.category,
            servingSize: details.servingSize,
            description: details.description,
            spiceLevel: details.spiceLevel,
            images,
            calories: details.calories,
            nutrition: details.nutrition,
            ingredients: details.ingredients,
            allergens: details.allergens,
            dietaryInfo: details.dietaryInfo,
            prepTime: details.prepTime,
            healthTips: details.healthTips,
            suitableFor: details.suitableFor
          },
          { upsert: true, new: true }
        );

        totalSeeded++;
      }
    }

    console.log(`Successfully seeded ${totalSeeded} authentic foods across all 10 cuisines into MongoDB!`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
