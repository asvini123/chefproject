const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Food = require('./models/Food');
require('dotenv').config();

const SOURCE_DIR = 'C:\\Users\\user\\Desktop\\proj-relateds\\imagecollections';
const DEST_DIR = path.join(__dirname, 'public', 'images', 'foods');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chefnest')
  .then(() => console.log('MongoDB Connected for Seeding'))
  .catch(err => console.log(err));

async function copyAndSeed() {
  try {
    if (!fs.existsSync(DEST_DIR)) {
      fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    // Clear existing foods
    await Food.deleteMany({});
    console.log('Cleared existing foods.');

    const cuisines = fs.readdirSync(SOURCE_DIR);

    for (const cuisine of cuisines) {
      const cuisinePath = path.join(SOURCE_DIR, cuisine);
      if (fs.statSync(cuisinePath).isDirectory()) {
        const cuisineDestPath = path.join(DEST_DIR, cuisine);
        if (!fs.existsSync(cuisineDestPath)) {
          fs.mkdirSync(cuisineDestPath, { recursive: true });
        }

        const foods = fs.readdirSync(cuisinePath);

        for (const food of foods) {
          const foodPath = path.join(cuisinePath, food);
          if (fs.statSync(foodPath).isDirectory()) {
            const foodDestPath = path.join(cuisineDestPath, food);
            if (!fs.existsSync(foodDestPath)) {
              fs.mkdirSync(foodDestPath, { recursive: true });
            }

            const images = fs.readdirSync(foodPath);
            const imagePaths = [];

            for (const image of images) {
              const ext = path.extname(image).toLowerCase();
              if (['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) {
                const srcImage = path.join(foodPath, image);
                const destImage = path.join(foodDestPath, image);
                fs.copyFileSync(srcImage, destImage);
                imagePaths.push(`/images/foods/${cuisine}/${food}/${image}`);
              }
            }

            // Clean up cuisine name (e.g. "Srilankan foods" -> "Srilankan")
            const cleanCuisineName = cuisine.replace(/ foods$/i, '');
            
            // Generate comprehensive mock data
            const randomCalories = Math.floor(Math.random() * (800 - 200 + 1) + 200) + ' kcal';
            const mockIngredients = [
              'Fresh local produce', 'Authentic spices', 'Premium cooking oil', 
              'Herbs for garnish', 'Chef special sauce', 'Garlic paste', 'Onions'
            ];
            
            const spiceLevels = [1, 2, 3, 4, 5];
            const categories = ["Main Course", "Appetizer", "Side Dish", "Dessert", "Snack"];
            
            await Food.create({
              name: food,
              cuisine: cleanCuisineName,
              images: imagePaths,
              category: categories[Math.floor(Math.random() * categories.length)],
              servingSize: "1 serving (approx 200g)",
              description: `Authentic ${cleanCuisineName} style ${food}. Freshly prepared by our expert private chefs using traditional recipes and premium ingredients.`,
              spiceLevel: spiceLevels[Math.floor(Math.random() * spiceLevels.length)],
              calories: randomCalories,
              nutrition: {
                protein: Math.floor(Math.random() * 40 + 5) + " g",
                carbs: Math.floor(Math.random() * 60 + 10) + " g",
                fat: Math.floor(Math.random() * 30 + 5) + " g",
                saturatedFat: Math.floor(Math.random() * 10 + 1) + " g",
                fiber: Math.floor(Math.random() * 10 + 1) + " g",
                sugar: Math.floor(Math.random() * 15 + 1) + " g",
                cholesterol: Math.floor(Math.random() * 150) + " mg",
                sodium: Math.floor(Math.random() * 1000 + 100) + " mg"
              },
              ingredients: mockIngredients,
              allergens: ["Dairy", "Nuts (Optional)"],
              dietaryInfo: ["✅ High Protein", "❌ Vegan"],
              prepTime: {
                preparation: "20 mins",
                marination: "30 mins",
                cooking: "25 mins",
                total: "1 hr 15 mins"
              },
              healthTips: [
                "Air fry or bake instead of deep frying to reduce fat.",
                "Pair with a fresh salad for a balanced meal."
              ],
              suitableFor: ["Lunch", "Dinner", "Party Appetizer"]
            });
            console.log(`Seeded: ${food} (${cleanCuisineName}) with ${imagePaths.length} images`);
          }
        }
      }
    }

    console.log('Seeding and Copying Complete!');
    process.exit();
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
}

copyAndSeed();
