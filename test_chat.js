const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/chefnest');
  const User = require('./models/User');
  const Message = require('./models/Message');

  const admin = await User.findOne({ role: 'admin' });
  console.log('Admin:', admin ? { id: admin._id, name: admin.firstName + ' ' + admin.lastName, role: admin.role } : 'None');

  if (admin) {
    const msgs = await Message.find({
      $or: [{ senderId: admin._id }, { receiverId: admin._id }]
    }).sort({ createdAt: -1 }).limit(10);

    console.log('Admin Messages Count:', msgs.length);
    msgs.forEach(m => console.log('From:', m.senderId, '| To:', m.receiverId, '| Content:', m.content));
  }

  process.exit(0);
}

test();
