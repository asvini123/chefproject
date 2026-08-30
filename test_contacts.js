const mongoose = require('mongoose');

async function testContacts() {
  await mongoose.connect('mongodb://localhost:27017/chefnest');
  const User = require('./models/User');
  const Message = require('./models/Message');

  const chef = await User.findOne({ email: 'ari8@gmail.com' });
  console.log('Chef:', chef ? { id: chef._id, name: chef.firstName + ' ' + chef.lastName } : 'Not found');

  const myId = chef._id;
  const adminObj = await User.findOne({ role: 'admin' }).select('firstName lastName email profilePhoto');
  const rawChefs = await User.find({ role: 'chef', isApproved: true, _id: { $ne: myId } }).select('firstName lastName email profilePhoto chefType city');
  const rawClients = await User.find({ role: 'user' }).select('firstName lastName email profilePhoto memberId');

  console.log('Found Admin:', adminObj);
  console.log('Found Raw Chefs:', rawChefs.length);
  console.log('Found Raw Clients:', rawClients.length);

  process.exit(0);
}

testContacts();
