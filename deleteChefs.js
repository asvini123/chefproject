const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/chefdb'); // Assuming 'chefdb' based on common naming, let's check config if it fails
  const res = await User.deleteMany({
    name: { $in: ['Chef Kamal Perera', 'Chef Nethmi Fernando', 'Chef Sajith Silva', 'Kamal Perera', 'Nethmi Fernando', 'Sajith Silva', 'Malini de Silva', 'Ruwan Peiris'] }
  });
  console.log('Deleted seed chefs:', res.deletedCount);
  process.exit(0);
}
run().catch(console.error);
