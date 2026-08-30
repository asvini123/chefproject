require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const indexRouter = require('./routes/index');

// ChefNest Master Server - Reloaded: 2026-08-28 13:43 ── Prevent the whole server from dying on unhandled errors ──
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UnhandledRejection] at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err.message);
});

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);

// Make io accessible in routers
app.set('io', io);

// Socket.io connection handling
const Message = require('./models/Message');

io.on('connection', (socket) => {
  // Join user's private personal room
  socket.on('join-user', (userId) => {
    if (userId) {
      socket.join('user_' + userId);
      console.log(`Socket ${socket.id} joined personal room user_${userId}`);
    }
  });

  // Global Chef Chat
  socket.on('join-chat', () => {
    socket.join('chef-chat');
  });

  socket.on('send-message', async (data) => {
    io.to('chef-chat').emit('receive-message', data);
  });

  // Real-time 1-on-1 Private Message
  socket.on('send-private-message', async (data) => {
    try {
      const { senderId, receiverId, content } = data;
      if (!senderId || !receiverId || !content || !content.trim()) return;

      const newMsg = new Message({
        senderId,
        receiverId,
        content: content.trim()
      });
      await newMsg.save();
      await newMsg.populate('senderId', 'firstName lastName role profilePhoto');
      await newMsg.populate('receiverId', 'firstName lastName role profilePhoto');

      // Emit to both sender and receiver rooms
      io.to('user_' + senderId).emit('new-private-message', newMsg);
      io.to('user_' + receiverId).emit('new-private-message', newMsg);

      // Notification to receiver
      io.to('user_' + receiverId).emit('chat-notification', {
        senderId,
        senderName: `${newMsg.senderId.firstName} ${newMsg.senderId.lastName}`,
        content: newMsg.content
      });
    } catch (err) {
      console.error('Error handling send-private-message socket:', err);
    }
  });

  // Global Chef Lounge Room
  socket.on('join-chat', () => {
    socket.join('global_chef_room');
  });

  // Global Chef Chat Handler (Persisted to MongoDB)
  socket.on('send-global-message', async (data) => {
    try {
      const { senderId, content } = data;
      if (!senderId || !content || !content.trim()) return;

      const newMsg = new Message({
        senderId,
        roomType: 'global-chef',
        content: content.trim()
      });
      await newMsg.save();
      await newMsg.populate('senderId', 'firstName lastName profilePhoto');

      const payload = {
        _id: String(newMsg._id),
        senderId: String(newMsg.senderId._id),
        sender: `${newMsg.senderId.firstName} ${newMsg.senderId.lastName}`,
        firstName: newMsg.senderId.firstName,
        profilePhoto: newMsg.senderId.profilePhoto || '',
        content: newMsg.content,
        createdAt: newMsg.createdAt
      };

      io.emit('receive-global-message', payload);
    } catch (err) {
      console.error('Error handling send-global-message socket:', err);
    }
  });

  socket.on('disconnect', () => {
    // console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration — persistent MongoDB store
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

app.use(session({
  secret: process.env.SESSION_SECRET || 'chefnest-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/chefnest',
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    autoRemove: 'native'
  }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: false // set true only with HTTPS
  }
}));

// Expose user session to EJS templates globally
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB connection (cloud / local)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chefnest')
  .then(() => {
    console.log('MongoDB connected ✅');
    // Seed default admin account
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    seedAdmin(User, bcrypt);
  })
  .catch((err) => console.error('MongoDB connection error ❌', err));

async function seedAdmin(User, bcrypt) {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const defaultAdmin = new User({
        role: 'admin',
        firstName: 'Arjun',
        lastName: 'Silva',
        email: 'admin@chefnest.com',
        phone: '0771234567',
        password: hashedPassword,
        address: 'HQ Colombo',
        city: 'Colombo',
        isApproved: true
      });
      await defaultAdmin.save();
      console.log('Default admin seeded: admin@chefnest.com / admin123 ✅');
    } else {
      // Always sync name if it's still the old default
      if (!adminExists.firstName || ['Kavindu', 'Super', 'Admin'].includes(adminExists.firstName)) {
        await User.updateOne({ _id: adminExists._id }, { $set: { firstName: 'Arjun', lastName: 'Silva' } });
        console.log('Admin name updated to Arjun Silva ✅');
      }
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
}

// Test route
app.use('/', indexRouter);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
