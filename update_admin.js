require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/chefnest').then(async () => {
  const col = mongoose.connection.collection('users');
  const setOp = {};
  setOp['$set'] = { firstName: 'Arjun', lastName: 'Silva' };
  await col.updateOne({ role: 'admin' }, setOp);
  const u = await col.findOne({ role: 'admin' });
  console.log('Admin name is now:', u.firstName, u.lastName);
  mongoose.disconnect();
}).catch(console.error);
