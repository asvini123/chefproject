const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Cuisine = require('./models/Cuisine');
const Course = require('./models/Course');
const Booking = require('./models/Booking');
const Notification = require('./models/Notification');

async function seedData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/chefnest');
    console.log('Connected to MongoDB for seeding...');

    // Clear existing dummy data (optional but good for a fresh start)
    await User.deleteMany({ role: { $ne: 'admin' } }); // Keep admin
    await Cuisine.deleteMany({});
    await Course.deleteMany({});
    await Booking.deleteMany({});
    await Notification.deleteMany({});
    console.log('Cleared existing data (kept admin)...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Seed Cuisines
    const cuisinesData = [
      { name: 'Sri Lankan', icon: '🇱🇰' },
      { name: 'Italian', icon: '🇮🇹' },
      { name: 'Indian', icon: '🇮🇳' },
      { name: 'Chinese', icon: '🇨🇳' },
      { name: 'Mexican', icon: '🇲🇽' },
      { name: 'French', icon: '🇫🇷' },
      { name: 'Vegan', icon: '🌱' }
    ];
    const cuisines = await Cuisine.insertMany(cuisinesData);
    console.log(`Seeded ${cuisines.length} cuisines...`);

    // Seed Chefs
    const chefsData = [
      {
        role: 'chef',
        firstName: 'Kamal',
        lastName: 'Perera',
        email: 'kamal.chef@chefnest.com',
        phone: '0771112222',
        password: hashedPassword,
        address: 'Colombo 7',
        city: 'Colombo',
        chefType: 'professional',
        experience: 8,
        cuisines: ['sri_lankan', 'indian'],
        hourlyRate: 2500,
        bio: 'Expert in authentic Sri Lankan and South Indian cuisine with over 8 years of hotel experience.',
        isApproved: true
      },
      {
        role: 'chef',
        firstName: 'Nethmi',
        lastName: 'Fernando',
        email: 'nethmi.chef@chefnest.com',
        phone: '0712223333',
        password: hashedPassword,
        address: 'Mount Lavinia',
        city: 'Colombo',
        chefType: 'home_cook',
        experience: 4,
        cuisines: ['italian', 'vegan'],
        hourlyRate: 1800,
        bio: 'Passionate home cook specializing in healthy Italian dishes and vegan alternatives.',
        isApproved: true
      },
      {
        role: 'chef',
        firstName: 'Sajith',
        lastName: 'Silva',
        email: 'sajith.chef@chefnest.com',
        phone: '0753334444',
        password: hashedPassword,
        address: 'Kandy Town',
        city: 'Kandy',
        chefType: 'professional',
        experience: 12,
        cuisines: ['chinese', 'sri_lankan'],
        hourlyRate: 3000,
        bio: 'Former head chef with deep expertise in fusion Asian and classic Chinese dishes.',
        isApproved: false // Pending approval
      }
    ];
    const chefs = await User.insertMany(chefsData);
    console.log(`Seeded ${chefs.length} chefs...`);

    // Seed Users
    const usersData = [
      {
        role: 'user',
        firstName: 'Amal',
        lastName: 'Dias',
        email: 'amal.dias@gmail.com',
        phone: '0779998888',
        password: hashedPassword,
        address: 'Nugegoda',
        city: 'Colombo'
      },
      {
        role: 'user',
        firstName: 'Tharushi',
        lastName: 'Perera',
        email: 'tharushi.p@gmail.com',
        phone: '0718887777',
        password: hashedPassword,
        address: 'Dehiwala',
        city: 'Colombo'
      }
    ];
    const users = await User.insertMany(usersData);
    console.log(`Seeded ${users.length} users...`);

    // Seed Courses
    const coursesData = [
      {
        title: 'Mastering Sri Lankan Curries',
        chefId: chefs[0]._id, // Kamal
        cuisineId: cuisines[0]._id, // Sri Lankan
        duration: '3 hours',
        price: 5000,
        status: 'Live'
      },
      {
        title: 'Vegan Pasta Making',
        chefId: chefs[1]._id, // Nethmi
        cuisineId: cuisines[1]._id, // Italian
        duration: '2 hours',
        price: 3500,
        status: 'Pending'
      }
    ];
    const courses = await Course.insertMany(coursesData);
    console.log(`Seeded ${courses.length} courses...`);

    // Seed Bookings
    const bookingsData = [
      {
        userId: users[0]._id, // Amal
        chefId: chefs[0]._id, // Kamal
        bookingType: 'Daily',
        date: new Date(Date.now() + 86400000 * 2), // 2 days from now
        time: '18:00',
        duration: 3,
        location: 'Nugegoda',
        guests: { adults: 4, children: 1 },
        totalAmount: 7500,
        status: 'Accepted',
        paymentMethod: 'Card'
      },
      {
        userId: users[1]._id, // Tharushi
        chefId: chefs[1]._id, // Nethmi
        bookingType: 'Event',
        date: new Date(Date.now() + 86400000 * 5), // 5 days from now
        time: '12:00',
        duration: 4,
        location: 'Dehiwala',
        guests: { adults: 2, children: 0 },
        totalAmount: 7200,
        status: 'Pending',
        paymentMethod: 'Cash'
      }
    ];
    const bookings = await Booking.insertMany(bookingsData);
    console.log(`Seeded ${bookings.length} bookings...`);

    // Seed Notifications
    const notificationsData = [
      { title: 'New Chef Registration', message: 'Chef Sajith Silva just registered.', type: 'signup' },
      { title: 'New Booking', message: 'Amal Dias booked Chef Kamal Perera.', type: 'booking' }
    ];
    await Notification.insertMany(notificationsData);
    console.log('Seeded notifications...');

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
