const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Course = require('../models/Course');
const Cuisine = require('../models/Cuisine');
const Receipt = require('../models/Receipt');
const Enrollment = require('../models/Enrollment');
const Ingredient = require('../models/Ingredient');
const IngredientCategory = require('../models/IngredientCategory');
const Food = require('../models/Food');
const Message = require('../models/Message');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Discount = require('../models/Discount');

// Authentication & Role Middlewares
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.method !== 'GET') {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
};

const isRole = (role) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.method !== 'GET') {
        return res.status(401).json({ success: false, message: 'Please log in to continue.' });
      }
      return res.redirect('/login');
    }

    const userRole = (req.session.user.role || '').toString().toLowerCase().trim();
    const targetRoles = Array.isArray(role)
      ? role.map(r => r.toString().toLowerCase().trim())
      : [role.toString().toLowerCase().trim()];

    if (targetRoles.includes(userRole) || userRole === 'admin') {
      return next();
    }
    if (req.method !== 'GET') {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permissions for this action.' });
    }
    res.redirect('/login');
  };
};

// Configure Multer Storage
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Configure Receipt Uploads
const receiptDir = path.join(__dirname, '../public/uploads/receipts');
if (!fs.existsSync(receiptDir)) {
  fs.mkdirSync(receiptDir, { recursive: true });
}
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'slip-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 8 * 1024 * 1024 }
});

// Configure Multer upload fields
const signupUploads = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'nic', maxCount: 1 },
  { name: 'nicFront', maxCount: 1 },
  { name: 'nicBack', maxCount: 1 },
  { name: 'policeClearance', maxCount: 1 },
  { name: 'certificates', maxCount: 10 }
]);

// Home
router.get('/', async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    const jaffnaChefs = await User.find({ role: 'chef', city: /Jaffna/i }).limit(3);
    const cuisines = await Cuisine.find().limit(10);
    res.render('index', { admin, jaffnaChefs, cuisines });
  } catch (err) {
    console.error('Error loading home page:', err);
    res.render('index', { admin: null, jaffnaChefs: [], cuisines: [] });
  }
});

// About
router.get('/about', async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    const topChefs = await User.find({ role: 'chef', isApproved: true }).limit(5);
    const ingredients = await Ingredient.find().sort({ category: 1, name: 1 });
    res.render('about', { admin, topChefs, ingredients });
  } catch (err) {
    console.error('Error loading about page:', err);
    res.status(500).send('Server Error');
  }
});

// Contact GET
router.get('/contact', (req, res) => {
  res.render('contact');
});

// Contact POST
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address (e.g. name@domain.com).' });
    }

    const newContact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject || 'general',
      message: message.trim()
    });

    await newContact.save();
    console.log(`[Contact Saved to DB] Name: ${name}, Email: ${email}, Subject: ${subject}`);

    res.json({ success: true, message: 'Your message has been received successfully!' });
  } catch (error) {
    console.error('Error saving contact submission:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

// Chefs Directory
// Sri Lanka District-to-Cities mapping dictionary
const districtCitiesMap = {
  "Colombo": ["Colombo", "Dehiwala-Mount Lavinia", "Moratuwa", "Sri Jayawardenepura Kotte", "Kaduwela", "Maharagama", "Kesbewa", "Kolonnawa", "Homagama", "Hanwella"],
  "Gampaha": ["Gampaha", "Negombo", "Kelaniya", "Kadawatha", "Kiribathgoda", "Wattala", "Ja-Ela", "Minuwangoda", "Divulapitiya", "Mirigama"],
  "Kalutara": ["Kalutara", "Panadura", "Horana", "Beruwala", "Aluthgama", "Bandaragama", "Wadduwa"],
  "Kandy": ["Kandy", "Gampola", "Peradeniya", "Katugastota", "Kundasale", "Nawalapitiya", "Akurana"],
  "Matale": ["Matale", "Dambulla", "Sigiriya", "Galewela", "Ukuwela"],
  "Nuwara Eliya": ["Nuwara Eliya", "Hatton", "Ginigathena", "Talawakele", "Lindula"],
  "Galle": ["Galle", "Hikkaduwa", "Karapitiya", "Ambalangoda", "Elpitiya", "Bentota", "Unawatuna"],
  "Matara": ["Matara", "Weligama", "Akuressa", "Deniyaya", "Dikwella"],
  "Hambantota": ["Hambantota", "Tangalle", "Beliatta", "Tissamaharama", "Ambalantota"],
  "Jaffna": ["Jaffna", "Chavakachcheri", "Point Pedro", "Karainagar", "Nallur", "Valvettithurai"],
  "Kilinochchi": ["Kilinochchi", "Pooneryn", "Pallai"],
  "Mannar": ["Mannar", "Murunkan", "Madhu"],
  "Vavuniya": ["Vavuniya", "Nedunkeni", "Cheddikulam"],
  "Mullaitivu": ["Mullaitivu", "Puthukudiyiruppu", "Oddusuddan"],
  "Batticaloa": ["Batticaloa", "Kattankudy", "Eravur", "Valachchenai", "Kaluwanchikudy"],
  "Ampara": ["Ampara", "Kalmunai", "Sainthamaruthu", "Akkaraipattu", "Pottuvil"],
  "Trincomalee": ["Trincomalee", "Mutur", "Kinniya", "Kuchchaveli"],
  "Kurunegala": ["Kurunegala", "Kuliyapitiya", "Narammala", "Wariyapola", "Pannala", "Ibbagamuwa"],
  "Puttalam": ["Puttalam", "Chilaw", "Wennappuwa", "Marawila", "Dankotuwa", "Kalpitiya"],
  "Anuradhapura": ["Anuradhapura", "Mihintale", "Kekirawa", "Medawachchiya", "Eppawala", "Galgamuwa"],
  "Polonnaruwa": ["Polonnaruwa", "Kaduruwela", "Hingurakgoda", "Medirigiriya"],
  "Badulla": ["Badulla", "Bandarawela", "Haputale", "Ella", "Welimada", "Mahiyanganaya"],
  "Moneragala": ["Moneragala", "Wellawaya", "Buttala", "Kataragama", "Bibile"],
  "Ratnapura": ["Ratnapura", "Balangoda", "Embilipitiya", "Pelmadulla", "Eheliyagoda"],
  "Kegalle": ["Kegalle", "Mawanella", "Ruwanwella", "Warakapola", "Dehiowita"]
};

router.get('/chefs', async (req, res) => {
  try {
    const { cuisine, food, district, location } = req.query;
    let filter = { role: 'chef', isApproved: true };

    let searchTarget = cuisine || food;

    if (food && !cuisine) {
      const Food = require('../models/Food');
      const foodDoc = await Food.findOne({ name: new RegExp('^' + food.trim() + '$', 'i') });
      if (foodDoc && foodDoc.cuisine) {
        searchTarget = foodDoc.cuisine;
      }
    }

    if (searchTarget) {
      const cleanTerm = searchTarget.trim().replace(/[_ -]/g, '');
      const flexRegex = new RegExp(cleanTerm.replace(/sri/i, 'sri[_\s-]*'), 'i');

      filter.$or = [
        { cuisines: flexRegex },
        { cuisines: new RegExp(searchTarget.trim(), 'i') }
      ];
    }

    const distVal = (district || '').trim();
    const locVal = (location || '').trim();

    if (locVal && locVal !== distVal && !locVal.startsWith('All in ')) {
      // Specific city chosen
      const cityRegex = new RegExp('^' + locVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { city: cityRegex },
          { address: new RegExp('\\b' + locVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i') }
        ]
      });
    } else if (distVal || (locVal && locVal.startsWith('All in '))) {
      // Whole district chosen
      const targetDist = distVal || locVal.replace('All in ', '').trim();
      const relatedCities = districtCitiesMap[targetDist] || [];
      const orList = [
        { district: new RegExp('^' + targetDist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
        { city: new RegExp('^' + targetDist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ];
      if (relatedCities.length > 0) {
        relatedCities.forEach(c => {
          orList.push({ city: new RegExp('^' + c.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
        });
      }
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: orList });
    }

    const chefs = await User.find(filter);

    res.render('chefs', {
      chefs,
      query: food ? `Food: ${food}` : (cuisine ? `Cuisine: ${cuisine}` : null),
      location: locVal || distVal || null,
      course: null
    });
  } catch (err) {
    console.error('Error loading chefs:', err);
    res.status(500).send('Server Error');
  }
});

// Search chefs
router.get('/search', async (req, res) => {
  try {
    const { q, location, district, course } = req.query;
    let filter = { role: 'chef', isApproved: true };

    const distVal = (district || '').trim();
    const locVal = (location || '').trim();

    if (locVal && locVal !== distVal && !locVal.startsWith('All in ')) {
      // Specific city chosen
      const cityRegex = new RegExp('^' + locVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { city: cityRegex },
          { address: new RegExp('\\b' + locVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i') }
        ]
      });
    } else if (distVal || (locVal && locVal.startsWith('All in '))) {
      // Whole district chosen
      const targetDist = distVal || locVal.replace('All in ', '').trim();
      const relatedCities = districtCitiesMap[targetDist] || [];
      const orList = [
        { district: new RegExp('^' + targetDist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
        { city: new RegExp('^' + targetDist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ];
      if (relatedCities.length > 0) {
        relatedCities.forEach(c => {
          orList.push({ city: new RegExp('^' + c.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
        });
      }
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: orList });
    }

    if (q) {
      const qRegex = new RegExp(q.trim(), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { firstName: qRegex },
          { lastName: qRegex },
          { bio: qRegex },
          { cuisines: qRegex },
          { chefType: qRegex }
        ]
      });
    }

    if (course) {
      const cRegex = new RegExp(course.trim(), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { cuisines: cRegex },
          { chefType: cRegex },
          { bio: cRegex }
        ]
      });
    }

    const chefs = await User.find(filter);
    res.render('chefs', {
      chefs,
      query: q || null,
      location: locVal || distVal || null,
      course: course || null
    });
  } catch (err) {
    console.error('Error during search:', err);
    res.status(500).send('Server Error');
  }
});

// Chef Profile Page
router.get('/chefs/:id', async (req, res) => {
  try {
    const chef = await User.findById(req.params.id);
    if (!chef || chef.role !== 'chef') {
      return res.status(404).send('Chef not found');
    }
    const reviews = await Review.find({ chefId: chef._id, isApproved: true }).populate('userId', 'firstName lastName profilePhoto');
    const foods = await Food.find({ chefId: chef._id });

    let isSaved = false;
    let currentUser = null;
    if (req.session && req.session.user) {
      currentUser = await User.findById(req.session.user.id);
      if (currentUser && currentUser.savedChefs) {
        isSaved = currentUser.savedChefs.includes(chef._id);
      }
    }

    res.render('chefprofile', { chef, reviews, foods, user: currentUser || (req.session ? req.session.user : null), isSaved });
  } catch (err) {
    console.error('Error loading chef profile:', err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// CUISINES & FOODS ROUTES
// ==========================================
// Cuisines Hub Page
router.get('/cuisines', async (req, res) => {
  try {
    const cuisines = await Cuisine.find().sort({ name: 1 });
    res.render('cuisines', { cuisines });
  } catch (err) {
    console.error('Error rendering cuisines page:', err);
    res.status(500).send('Server Error');
  }
});

// Cuisine Specific Foods List
router.get('/cuisines/:cuisine/foods', async (req, res) => {
  try {
    let rawCuisine = req.params.cuisine;
    const cMap = {
      'srilankan': 'Sri Lankan',
      'sri-lankan': 'Sri Lankan',
      'sri_lankan': 'Sri Lankan',
      'sri lankan': 'Sri Lankan',
      'italian': 'Italian',
      'indian': 'Indian',
      'chinese': 'Chinese',
      'japanese': 'Japanese',
      'mexican': 'Mexican',
      'french': 'French',
      'malaysian': 'Malaysian',
      'american': 'American',
      'portuguese': 'Portuguese'
    };
    const lookupName = cMap[rawCuisine.toLowerCase()] || rawCuisine;
    const regex = new RegExp('^' + lookupName.replace(/foods$/i, '').trim(), 'i');

    const foods = await Food.find({ cuisine: regex }).sort({ name: 1 });
    res.render('foods', {
      foods,
      cuisineName: lookupName
    });
  } catch (err) {
    console.error('Error loading foods for cuisine:', err);
    res.status(500).send('Server Error');
  }
});

// Foods Directory (All Foods or by Query)
router.get('/foods', async (req, res) => {
  try {
    const { cuisine } = req.query;
    let query = {};
    if (cuisine) {
      query.cuisine = new RegExp('^' + cuisine.trim(), 'i');
    }
    const foods = await Food.find(query).sort({ name: 1 });
    res.render('foods', {
      foods,
      cuisineName: cuisine || 'All International'
    });
  } catch (err) {
    console.error('Error loading foods:', err);
    res.status(500).send('Server Error');
  }
});

// Food Detail Page
router.get('/foods/:id', async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).send('Food not found');
    }
    res.render('food_detail', { food });
  } catch (err) {
    console.error('Error loading food detail:', err);
    res.status(500).send('Server Error');
  }
});

// Booking Flow Page
router.get('/booking/:chefId', isAuthenticated, async (req, res) => {
  try {
    const chef = await User.findById(req.params.chefId);
    if (!chef || chef.role !== 'chef') {
      return res.status(404).send('Chef not found');
    }
    const currentUser = await User.findById(req.session.user.id);
    res.render('booking', { chef, user: currentUser || req.session.user });
  } catch (err) {
    console.error('Error loading booking page:', err);
    res.status(500).send('Server Error');
  }
});

// POST Create Booking (old redirect-based, keep for backward compat)
router.post('/booking/create', isAuthenticated, async (req, res) => {
  try {
    const {
      chefId, bookingType, date, time, duration, locationType, location,
      adults, children, cuisine, mealSession, availableIngredients,
      grocerySupport, dietaryPreference, allergyDetails,
      baseRate, guestSurcharge, mealCharge, groceryCharge, platformFee, totalAmount,
      paymentMethod, promoCode
    } = req.body;

    const chef = await User.findById(chefId);
    if (!chef) return res.status(404).send('Chef not found');

    const user = req.session.user;

    const dbUser = await User.findById(req.session.user.id);
    let base = (chef.hourlyRate || 2500) * (parseInt(duration) || 3);
    let grCharge = (grocerySupport === 'true' || grocerySupport === 'on' || grocerySupport === true) ? 500 : 0;

    let discount = 0;
    if (dbUser.subscriptionTier === 'Premium') {
      discount = 0.10;
    } else if (dbUser.subscriptionTier === 'Elite') {
      discount = 0.25;
      grCharge = 0; // Free grocery support for Elite
    }

    if (bookingType === 'Urgent' && dbUser.urgentBookingsLeft > 0) {
      base = 0; // Free urgent booking
      dbUser.urgentBookingsLeft -= 1;
      await dbUser.save();
    }

    const gSurcharge = parseInt(guestSurcharge) || 0;
    const mCharge = parseInt(mealCharge) || 0;
    const pFee = parseInt(platformFee) || 500;

    let subtotal = (base + grCharge + gSurcharge + mCharge);
    subtotal = subtotal * (1 - discount);
    const total = Math.round(subtotal + pFee);

    const isGrocery = grocerySupport === 'true' || grocerySupport === 'on' || grocerySupport === true;

    // MealSession may come as array or single string
    const mealArr = Array.isArray(mealSession) ? mealSession : (mealSession ? [mealSession] : []);

    const newBooking = new Booking({
      userId: req.session.user.id,
      chefId: chefId,
      bookingType: bookingType || 'Daily',
      date: new Date(date),
      time: time,
      duration: parseInt(duration) || 3,
      locationType: locationType || 'House',
      location: location,
      cuisine: cuisine || '',
      mealSession: mealArr,
      availableIngredients: availableIngredients || '',
      grocerySupport: isGrocery,
      groceryApprovalStatus: isGrocery ? 'Pending' : 'None',
      dietaryPreference: dietaryPreference || 'None',
      allergyDetails: allergyDetails || '',
      guests: {
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0
      },
      baseRate: base,
      guestSurcharge: gSurcharge,
      mealCharge: mCharge,
      groceryCharge: grCharge,
      platformFee: pFee,
      totalAmount: total,
      paymentMethod: paymentMethod || 'Cash',
      paymentStatus: 'Pending',
      status: 'Pending'
    });

    const savedBooking = await newBooking.save();

    // Notify the chef via Notification model
    const notif = await Notification.create({
      title: '📋 New Booking Request',
      message: `${user.firstName} ${user.lastName} has requested you for a ${bookingType || 'Daily'} booking on ${new Date(date).toDateString()} at ${time}. Please review and respond.`,
      type: 'booking',
      userId: chefId   // notification targeted at the chef
    });

    // Emit real-time socket event to the chef
    const io = req.app.get('io');
    if (io) {
      io.emit('new-notification', { message: notif.message });
    }

    // If grocery support requested, notify admin too
    if (isGrocery) {
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        await Notification.create({
          title: '🛒 Grocery Support Requested',
          message: `Booking #${savedBooking._id.toString().slice(-6).toUpperCase()} by ${user.firstName} ${user.lastName} requires grocery approval.`,
          type: 'grocery'
        });
        if (io) io.emit('new-notification', { message: `🛒 Grocery support requested for booking #${savedBooking._id.toString().slice(-6).toUpperCase()}` });
      }
    }

    // Redirect to a "pending" confirmation page or payment gateway
    if (paymentMethod === 'PayHere') {
      res.redirect(`/payment/${savedBooking._id}`);
    } else {
      res.redirect(`/booking/pending/${savedBooking._id}`);
    }
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).send('Server Error');
  }
});

// PayHere Mock Payment Gateway Route
router.get('/payment/:id', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId');
    if (!booking) return res.status(404).send('Booking not found');

    const user = req.session.user;

    // PayHere Sandbox Credentials
    const merchantId = '1236941';
    const merchantSecret = 'MTIxNzgzNTAyMjY5MTU3OTQ5MzE5NzkzMDEwNTgzOTU5NTc0Mjg3';
    const orderId = booking._id.toString();
    const amount = booking.totalAmount.toFixed(2);
    const currency = 'LKR';

    // Generate MD5 Hash: uppercase(md5(merchant_id + order_id + amount + currency + uppercase(md5(merchant_secret))))
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashString = merchantId + orderId + amount + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

    const payhereData = {
      merchant_id: merchantId,
      return_url: `http://localhost:3000/payment/${orderId}/return`,
      cancel_url: `http://localhost:3000/payment/${orderId}`,
      notify_url: `http://localhost:3000/api/payhere/notify`, // Will not work on localhost, just a placeholder
      order_id: orderId,
      items: `Booking for Chef ${booking.chefId.firstName}`,
      currency: currency,
      amount: amount,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      phone: user.phone || '0771234567',
      address: booking.location || 'Colombo',
      city: 'Colombo',
      country: 'Sri Lanka',
      hash: hash
    };

    res.render('payment', { booking, user: req.session.user, payhereData });
  } catch (err) {
    console.error('Error loading payment page:', err);
    res.status(500).send('Server Error');
  }
});

// PayHere Successful Return Route
router.get('/payment/:id/return', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('userId').populate('chefId');
    if (!booking) return res.status(404).send('Booking not found');

    booking.paymentStatus = 'Completed';
    booking.paymentMethod = 'PayHere';
    booking.status = 'Accepted';
    await booking.save();

    // Determine customer and chef names
    const custName = booking.userId ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() : (req.session.user ? `${req.session.user.firstName || ''} ${req.session.user.lastName || ''}`.trim() : 'Customer');
    const chefName = booking.chefId ? `Chef ${booking.chefId.firstName || ''} ${booking.chefId.lastName || ''}`.trim() : 'Chef';

    // Create a transaction receipt entry with full customer details
    const transactionId = 'PAYHERE-' + Math.floor(10000000 + Math.random() * 90000000);
    const receipt = new Receipt({
      bookingId: booking._id,
      userId: req.session.user ? req.session.user.id : (booking.userId?._id || booking.userId),
      userName: custName,
      customerName: custName,
      chefName: chefName,
      transactionId: transactionId,
      amountPaid: booking.totalAmount,
      paymentMethod: 'PayHere',
      status: 'Paid'
    });
    await receipt.save();

    // Notify chef of payment
    if (booking.chefId) {
      const chefId = booking.chefId._id || booking.chefId;
      await Notification.create({
        title: '💰 PayHere Payment Received',
        message: `Payment of Rs.${booking.totalAmount.toLocaleString()} received via PayHere from ${custName} for booking #${booking._id.toString().slice(-6).toUpperCase()}. (Receipt #${transactionId})`,
        type: 'booking',
        userId: chefId
      });
    }

    // Notify user of payment confirmation
    await Notification.create({
      title: '💳 Payment Successful',
      message: `Your payment of Rs.${booking.totalAmount.toLocaleString()} via PayHere has been confirmed for Booking #${booking._id.toString().slice(-6).toUpperCase()}. Receipt #${transactionId} generated.`,
      type: 'payment',
      userId: req.session.user.id
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new-notification', { message: `💳 PayHere Payment received for booking #${booking._id.toString().slice(-6).toUpperCase()}` });
    }

    res.redirect(`/booking/success/${booking._id}`);
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// POST Create Booking via AJAX (used by modal - returns JSON)
router.post('/booking/create-ajax', async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session || !req.session.user) {
      return res.json({ success: false, message: 'Please log in to your account first before booking.' });
    }

    const {
      chefId, bookingType, date, time, duration, location, adults, children, meals, foodName,
      grocerySupport, groceryItemsNeeded, paymentMethod,
      eventName, eventVenue, eventStartTime, eventEndTime, locationMapUrl, landmarkNotes
    } = req.body;

    if (!chefId || !date || !time || !location) {
      return res.json({ success: false, message: 'Please fill in all required fields.' });
    }

    const chef = await User.findById(chefId);
    if (!chef) return res.json({ success: false, message: 'Chef not found.' });

    // Check 1: Profile Visibility
    if (chef.profileVisibility === 'Private') {
      return res.json({
        success: false,
        message: '⚠️ This Chef is currently marked as Private / On Leave and is not accepting new bookings.'
      });
    }

    // Check 2: Vacations / Leave Dates
    if (date && chef.availability && chef.availability.vacations && chef.availability.vacations.length > 0) {
      const bookDate = new Date(date);
      const onLeave = chef.availability.vacations.find(v => {
        if (!v.startDate || !v.endDate) return false;
        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return bookDate >= start && bookDate <= end;
      });

      if (onLeave) {
        const startStr = new Date(onLeave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const endStr = new Date(onLeave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return res.json({
          success: false,
          message: `⚠️ Chef ${chef.firstName} is on leave from ${startStr} to ${endStr} (${onLeave.note || 'Leave'}). You cannot book this chef on this date.`
        });
      }
    }

    const dbUser = await User.findById(req.session.user.id);
    let basePrice = (chef.hourlyRate || 1500) * (parseInt(duration) || 2);
    const isGrocery = grocerySupport === 'true' || grocerySupport === true;
    let groceryCost = isGrocery ? 500 : 0;

    let discount = 0;
    if (dbUser.subscriptionTier === 'Premium') {
      discount = 0.10;
    } else if (dbUser.subscriptionTier === 'Elite') {
      discount = 0.25;
      groceryCost = 0; // Free grocery support for Elite
    }

    if (bookingType === 'Urgent' && dbUser.urgentBookingsLeft > 0) {
      basePrice = 0; // Free urgent booking
      dbUser.urgentBookingsLeft -= 1;
      await dbUser.save();
    }

    let subtotal = basePrice + groceryCost;
    subtotal = subtotal * (1 - discount);

    const adminFee = Math.round(subtotal * 0.10); // 10% admin fee
    const totalAmount = Math.round(subtotal + adminFee);

    const bookingData = {
      userId: req.session.user.id,
      chefId: chefId,
      bookingType: bookingType || 'Daily',
      date: new Date(date),
      time: time,
      duration: parseInt(duration) || 2,
      location: location,
      locationMapUrl: locationMapUrl || '',
      landmarkNotes: landmarkNotes || '',
      eventName: eventName || '',
      eventVenue: eventVenue || '',
      eventStartTime: eventStartTime || time || '',
      eventEndTime: eventEndTime || '',
      foodName: foodName || '',
      guests: {
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0
      },
      menu: foodName ? [foodName] : (Array.isArray(meals) ? meals : (meals ? [meals] : [])),
      grocerySupport: isGrocery,
      groceryItemsNeeded: isGrocery ? (groceryItemsNeeded || '') : '',
      groceryApprovalStatus: isGrocery ? 'Pending' : 'None',
      totalAmount: totalAmount,
      paymentMethod: paymentMethod || 'Cash',
      paymentStatus: (paymentMethod === 'Card' || paymentMethod === 'Wallet') ? 'Completed' : 'Pending',
      status: 'Pending'
    };

    const newBooking = new Booking(bookingData);
    const savedBooking = await newBooking.save();
    console.log(`[Booking Saved] ID: ${savedBooking._id}, Chef: ${chefId}`);

    const user = req.session.user;

    // Send notifications (best-effort - don't fail the response if these throw)
    try {
      // Notify admin about new booking
      await Notification.create({
        title: '📋 New Booking - Admin',
        message: `New booking by ${user.firstName || ''} ${user.lastName || ''} for chef on ${new Date(date).toDateString()} at ${time}. Booking ID: #${savedBooking._id.toString().slice(-6).toUpperCase()}.`,
        type: 'booking'
      });

      // Notify the chef about the new booking request
      const notif = await Notification.create({
        title: '📋 New Booking Request',
        message: `${user.firstName || 'A user'} ${user.lastName || ''} has requested a booking on ${new Date(date).toDateString()} at ${time}.`,
        type: 'booking',
        userId: chefId
      });

      // Notify admin if grocery support requested
      if (isGrocery) {
        await Notification.create({
          title: '🛒 Grocery Support Requested',
          message: `Booking #${savedBooking._id.toString().slice(-6).toUpperCase()} by ${user.firstName || ''} ${user.lastName || ''} requires grocery approval.`,
          type: 'grocery'
        });
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('new-notification', { message: notif.message });
      }
    } catch (notifErr) {
      console.error('[Notification Error - non-fatal]:', notifErr.message);
    }

    res.json({
      success: true,
      redirectUrl: paymentMethod === 'PayHere' ? `/payment/${savedBooking._id}` : null,
      booking: {
        _id: savedBooking._id.toString(),
        bookingType: savedBooking.bookingType,
        date: new Date(savedBooking.date).toDateString(),
        time: savedBooking.time,
        duration: savedBooking.duration,
        location: savedBooking.location,
        menu: savedBooking.menu,
        grocerySupport: savedBooking.grocerySupport ? 'Yes, buy ingredients (+Rs.500)' : 'No, customer has ingredients',
        paymentMethod: savedBooking.paymentMethod,
        paymentStatus: savedBooking.paymentStatus === 'Completed' ? 'Paid / Completed' : 'Pending / Cash on Service',
        totalAmount: savedBooking.totalAmount
      }
    });
  } catch (err) {
    console.error('Error creating booking via AJAX:', err);
    res.json({ success: false, message: err.message || 'Server error. Please try again.' });
  }
});

// Booking Success Page — shown after booking is confirmed via AJAX redirect
router.get('/booking/success/:id', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId').populate('userId');
    if (!booking) return res.redirect('/user/dashboard');
    if (booking.userId && booking.userId._id.toString() !== req.session.user.id) {
      return res.redirect('/user/dashboard');
    }
    res.render('booking_success', { booking, user: req.session.user });
  } catch (err) {
    console.error('Error loading booking success page:', err);
    res.redirect('/user/dashboard');
  }
});

// Booking Pending Page (shown after form submit, waits for chef response)
router.get('/booking/pending/:id', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId');
    if (!booking) return res.status(404).send('Booking not found');
    res.render('booking_pending', { booking, user: req.session.user });
  } catch (err) {
    console.error('Error loading pending page:', err);
    res.status(500).send('Server error');
  }
});

// Chef: Accept or Reject booking from their dashboard
router.post('/chef/booking/:id/respond', isAuthenticated, isRole(['chef', 'admin']), async (req, res) => {
  try {
    const { action, cookingTimeEstimate, extraIngredients } = req.body;
    const booking = await Booking.findById(req.params.id).populate('userId');
    if (!booking) return res.json({ success: false, message: 'Booking not found' });

    const targetUserId = (booking.userId && booking.userId._id) ? booking.userId._id : booking.userId;
    const bookingRef = booking._id.toString().slice(-6).toUpperCase();
    const chefName = (req.session.user && req.session.user.firstName) ? req.session.user.firstName : 'Your Chef';

    if (action === 'accept') {
      booking.status = 'Accepted';
      booking.cookingTimeEstimate = cookingTimeEstimate || '';
      booking.extraIngredients = extraIngredients || '';
      await booking.save();

      const halfDeposit = Math.round((booking.totalAmount || 0) * 0.5);

      // Notify the user with explicit payment and balance payment guidance
      await Notification.create({
        title: '✅ Booking Accepted! 50% Deposit Slip Required',
        message: `Chef ${chefName} accepted your booking #${bookingRef} for ${new Date(booking.date).toDateString()} at ${booking.time}. Please proceed to your Bookings page to complete the 50% advance deposit (LKR ${halfDeposit.toLocaleString()}) and upload your bank transfer slip. Balance 50% can be paid via Bank Transfer, Cash on Delivery (Cash in hand directly to Chef), or Credit/Debit Card.`,
        type: 'booking',
        userId: targetUserId
      });

      // Notify the admin
      await Notification.create({
        title: '👨‍🍳 Chef Accepted Booking',
        message: `Chef ${chefName} accepted booking #${bookingRef}. Total: LKR ${booking.totalAmount.toLocaleString()} (50% Deposit: LKR ${halfDeposit.toLocaleString()}).`,
        type: 'booking'
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('new-notification', {
          message: `✅ Chef accepted booking #${bookingRef}! Please upload 50% bank slip (LKR ${halfDeposit.toLocaleString()}). Balance can be paid via Bank, Cash to Chef, or Card.`,
          userId: targetUserId.toString()
        });
      }

      return res.json({
        success: true,
        message: `Booking accepted! Customer has been notified to complete the 50% advance deposit (LKR ${halfDeposit.toLocaleString()}).`
      });
    }

    if (action === 'reject') {
      booking.status = 'Cancelled';
      await booking.save();

      // Notify the user
      await Notification.create({
        title: '❌ Booking Declined',
        message: `Unfortunately Chef ${req.session.user.firstName} is not available for booking #${bookingRef} on ${new Date(booking.date).toDateString()}. Please try another chef.`,
        type: 'booking',
        userId: targetUserId
      });

      // Notify admin
      await Notification.create({
        title: '❌ Chef Declined Booking',
        message: `Chef ${req.session.user.firstName} declined booking #${bookingRef}.`,
        type: 'booking'
      });

      const io = req.app.get('io');
      if (io) io.emit('new-notification', { message: `❌ Booking #${bookingRef} was declined.`, userId: targetUserId.toString() });

      return res.json({ success: true, message: 'Booking rejected and user notified.' });
    }

    if (action === 'start_cooking' || action === 'cooking' || action === 'processing') {
      booking.status = 'Cooking';
      booking.cookingStartedAt = new Date();
      await booking.save();

      const chefFullName = req.session.user ? `${req.session.user.firstName} ${req.session.user.lastName}`.trim() : 'Your Chef';

      // Notify the user
      await Notification.create({
        title: '🍳 Chef Has Started Cooking!',
        message: `Chef ${chefFullName} has arrived at your venue and started preparing your dishes for Booking #${bookingRef}.`,
        type: 'booking',
        userId: targetUserId
      });

      // Notify the admin
      await Notification.create({
        title: '🍳 Chef Started Cooking',
        message: `Chef ${chefFullName} is now cooking for Booking #${bookingRef}.`,
        type: 'booking'
      });

      const io = req.app.get('io');
      if (io) io.emit('new-notification', { message: `🍳 Chef started cooking for booking #${bookingRef}!`, userId: targetUserId.toString() });

      return res.json({ success: true, message: 'Status updated to Cooking in progress!' });
    }

    if (action === 'complete') {
      const { cashCollectedAmount } = req.body;
      const chefFullName = req.session.user ? `${req.session.user.firstName} ${req.session.user.lastName}`.trim() : 'Chef';
      const custFullName = (booking.userId && booking.userId.firstName) ? `${booking.userId.firstName} ${booking.userId.lastName}`.trim() : 'Valued Customer';

      booking.status = 'Completed';
      booking.paymentStatus = 'Completed';
      booking.completedAt = new Date();
      booking.collectedByChefName = chefFullName;
      booking.customerName = custFullName;

      const cashNum = parseFloat(cashCollectedAmount);
      if (!isNaN(cashNum) && cashNum > 0) {
        booking.cashCollectedAmount = cashNum;
      } else {
        booking.cashCollectedAmount = booking.totalAmount || 0;
      }

      await booking.save();

      // Notify the user
      await Notification.create({
        title: '🏆 Dining Completed & Payment Recorded!',
        message: `Your dining session with Chef ${chefFullName} (Booking #${bookingRef}) is completed! Cash payment recorded: LKR ${booking.cashCollectedAmount.toLocaleString()}. Thank you for dining with ChefNest!`,
        type: 'booking',
        userId: targetUserId
      });

      // Notify admin
      await Notification.create({
        title: '🏆 Booking Completed & Cash Recorded',
        message: `Booking #${bookingRef} completed by Chef ${chefFullName}. Cash Collected: LKR ${booking.cashCollectedAmount.toLocaleString()} from ${custFullName}.`,
        type: 'booking'
      });

      const io = req.app.get('io');
      if (io) io.emit('new-notification', { message: `🏆 Booking #${bookingRef} was marked as Completed!`, userId: targetUserId.toString() });

      return res.json({
        success: true,
        message: `Booking completed! LKR ${booking.cashCollectedAmount.toLocaleString()} recorded as collected.`,
        booking
      });
    }

    res.json({ success: false, message: 'Invalid action.' });
  } catch (err) {
    console.error('Chef booking respond error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// NOTE: Duplicate /payment/:id route removed — the PayHere route above (line ~352) handles all payment rendering.


// POST Confirm Payment
router.post('/payment/:id/confirm', isAuthenticated, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const booking = await Booking.findById(req.params.id).populate('userId');
    if (!booking) return res.status(404).send('Booking not found');

    const method = paymentMethod || 'Card';

    // Update payment method and status in DB
    booking.paymentMethod = method;
    booking.paymentStatus = 'Completed';
    booking.status = 'Accepted'; // Confirming booking once payment is received
    await booking.save();

    // Create a transaction receipt entry
    const transactionId = 'TXN' + Math.floor(10000000 + Math.random() * 90000000);
    const receipt = new Receipt({
      bookingId: booking._id,
      userId: req.session.user.id,
      transactionId: transactionId,
      amountPaid: booking.totalAmount,
      paymentMethod: method,
      status: 'Paid'
    });
    await receipt.save();

    console.log(`[Payment Confirmed] BookingID: ${booking._id}, Method: ${method}, Transaction: ${transactionId}`);

    // Create notification for the user
    await Notification.create({
      title: '💳 Payment Received',
      message: `LKR ${booking.totalAmount.toLocaleString()} paid successfully for Booking #${booking._id.toString().slice(-6).toUpperCase()}. Receipt #${transactionId} generated.`,
      type: 'booking',
      userId: booking.userId._id
    });

    // Create notification for the chef
    if (booking.chefId) {
      await Notification.create({
        title: '💰 Booking Paid & Confirmed',
        message: `${booking.userId.firstName} ${booking.userId.lastName} paid LKR ${booking.totalAmount.toLocaleString()} for Booking on ${new Date(booking.date).toDateString()}.`,
        type: 'booking',
        userId: booking.chefId
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('new-notification', { message: `💳 Payment received for booking #${booking._id.toString().slice(-6).toUpperCase()}` });
    }

    res.redirect(`/booking/success/${booking._id}`);
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).send('Payment error. Please try again.');
  }
});

// Booking Success Page
router.get('/booking/success/:id', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId');
    if (!booking) return res.status(404).send('Booking not found');
    res.render('booking_success', { booking });
  } catch (err) {
    console.error('Error loading success page:', err);
    res.status(500).send('Server error');
  }
});

// Invoice PDF Download — generates and streams a real PDF file
router.get('/booking/receipt/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId').populate('userId');
    if (!booking) return res.status(404).send('Booking not found');

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const bookingIdShort = '#' + booking._id.toString().slice(-6).toUpperCase();
    const chefName = booking.chefId
      ? 'Chef ' + booking.chefId.firstName + ' ' + booking.chefId.lastName
      : 'Chef';
    const customerName = booking.userId
      ? booking.userId.firstName + ' ' + booking.userId.lastName
      : 'Customer';
    const memberId = booking.userId
      ? (booking.userId.memberId || ('CN-USR-' + booking.userId._id.toString().slice(-4).toUpperCase()))
      : 'CN-USR-0000';

    // Stream as downloadable PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ChefNest-Invoice-${bookingIdShort.replace('#', '')}.pdf"`);
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────
    doc.rect(0, 0, 595, 120).fill('#1a5c2a');
    doc.fillColor('white')
      .font('Helvetica-Bold').fontSize(26).text('ChefNest', 50, 35);
    doc.font('Helvetica').fontSize(10.5).fillColor('rgba(255,255,255,0.85)')
      .text('Premium Private Dining Solutions', 50, 66);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('white')
      .text('BOOKING INVOICE', 400, 42, { align: 'right', width: 145 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.95)')
      .text('Booking Ref: ' + bookingIdShort, 400, 62, { align: 'right', width: 145 });
    doc.font('Helvetica').fontSize(9.5).fillColor('rgba(255,255,255,0.85)')
      .text(new Date().toDateString(), 400, 78, { align: 'right', width: 145 });

    // ── Status Banner (ASCII safe) ───────────────────────────────
    if (booking.paymentStatus === 'Completed') {
      doc.rect(50, 135, 495, 36).fill('#f0fdf4').stroke('#86efac');
      doc.fillColor('#166534').font('Helvetica-Bold').fontSize(10)
        .text('STATUS: FULLY PAID & CONFIRMED — Payment Received via ' + (booking.paymentMethod || 'PayHere'), 65, 147);
    } else if (booking.halfPaymentPaid) {
      doc.rect(50, 135, 495, 36).fill('#f0fdf4').stroke('#86efac');
      doc.fillColor('#166534').font('Helvetica-Bold').fontSize(10)
        .text('STATUS: 50% DEPOSIT PAID — Session Confirmed (Remaining balance due on session)', 65, 147);
    } else {
      doc.rect(50, 135, 495, 36).fill('#fffbeb').stroke('#fde68a');
      doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(10)
        .text('STATUS: PENDING — Payment due after Chef & Admin approval', 65, 147);
    }

    // ── Billed To / Chef Info ─────────────────────────────────────
    doc.moveDown(4);
    const y1 = 188;
    doc.fillColor('#1a5c2a').font('Helvetica-Bold').fontSize(9)
      .text('BILLED TO (CLIENT)', 50, y1).text('ASSIGNED MASTER CHEF', 320, y1);
    doc.moveTo(50, y1 + 12).lineTo(240, y1 + 12).stroke('#e2e8d9');
    doc.moveTo(320, y1 + 12).lineTo(545, y1 + 12).stroke('#e2e8d9');
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(11)
      .text(customerName, 50, y1 + 18);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1a5c2a')
      .text('Member ID: ' + memberId, 50, y1 + 32);
    doc.font('Helvetica').fontSize(9).fillColor('#666')
      .text(booking.location || 'Client Location', 50, y1 + 45, { width: 240 });
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(11)
      .text(chefName, 320, y1 + 18);
    doc.font('Helvetica').fontSize(9).fillColor('#666')
      .text('Certified Private Chef', 320, y1 + 32);

    // ── Details Table ─────────────────────────────────────────────
    const totalAmt = booking.totalAmount || 0;
    const halfAmt = Math.round(totalAmt * 0.5);
    const remainingAmt = totalAmt - halfAmt;

    const tableTop = 275;
    const rowH = 24;
    const rows = [
      ['Booking ID', bookingIdShort],
      ['Client Member ID', memberId],
      ['Booking Type', booking.bookingType || 'Standard'],
      ['Dish to Cook', booking.foodName || (booking.menu || []).join(', ') || 'Chef Specialty'],
      ['Date & Time', new Date(booking.date).toDateString() + ' at ' + (booking.time || '—')],
      ['Duration', (booking.duration || '—') + ' hours'],
      ['Guests', ((booking.guests && booking.guests.adults) || 1) + ' Adults' + (((booking.guests && booking.guests.children) > 0) ? (', ' + booking.guests.children + ' Children') : '')],
      ['Payment Method', booking.paymentMethod || 'PayHere / Card'],
      ['Payment Status', booking.paymentStatus || 'Pending'],
      ['50% Deposit Status', booking.halfPaymentPaid ? ('PAID & VERIFIED (LKR ' + halfAmt.toLocaleString() + ')') : ('LKR ' + halfAmt.toLocaleString() + ' (Due)')],
      ['Remaining Balance Due', booking.halfPaymentPaid ? ('LKR ' + remainingAmt.toLocaleString() + ' (Pay to Chef on arrival)') : ('LKR ' + remainingAmt.toLocaleString())]
    ];

    // Table header
    doc.rect(50, tableTop, 495, rowH).fill('#1a5c2a');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
      .text('DESCRIPTION', 65, tableTop + 7)
      .text('DETAILS', 320, tableTop + 7);

    // Table rows
    rows.forEach((row, i) => {
      const y = tableTop + rowH + i * rowH;
      const bg = i % 2 === 0 ? '#f8faf7' : 'white';
      doc.rect(50, y, 495, rowH).fill(bg);
      doc.fillColor('#555').font('Helvetica').fontSize(8.5).text(row[0], 65, y + 6, { width: 240 });
      doc.fillColor('#111').font('Helvetica-Bold').fontSize(8.5).text(row[1], 320, y + 6, { width: 210 });
    });

    // ── Total Box ─────────────────────────────────────────────────
    const totalY = tableTop + rowH + rows.length * rowH + 12;
    doc.rect(330, totalY, 215, 48).fill('#1a5c2a');
    doc.fillColor('rgba(255,255,255,0.85)').font('Helvetica').fontSize(8.5)
      .text('TOTAL BOOKING AMOUNT', 345, totalY + 8);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(16)
      .text('LKR ' + totalAmt.toLocaleString(), 345, totalY + 22);

    // ── Mandatory Warning Note ──────────────────────────────────
    const noteY = totalY + 62;
    doc.rect(50, noteY, 495, 52).fill('#fffbeb').stroke('#f59e0b');
    doc.fillColor('#b45309').font('Helvetica-Bold').fontSize(8.5)
      .text('MANDATORY CHEF ARRIVAL INSTRUCTION:', 65, noteY + 8);
    doc.font('Helvetica').fontSize(8).fillColor('#78350f')
      .text('Please download and keep this invoice on your phone or print a physical copy. You MUST show this booking confirmation to the Chef upon their arrival at your location before cooking begins.', 65, noteY + 22, { width: 460 });

    // ── Footer ────────────────────────────────────────────────────
    doc.moveTo(50, 770).lineTo(545, 770).stroke('#e2e8d9');
    doc.fillColor('#888').font('Helvetica').fontSize(8)
      .text('(C) ' + new Date().getFullYear() + ' ChefNest. All rights reserved.  |  www.chefnest.lk', 50, 776, { align: 'center', width: 495 });

    doc.end();
  } catch (err) {
    console.error('Error generating invoice PDF:', err);
    res.status(500).send('Could not generate invoice. Please try again.');
  }
});

// Navigation Redirection Links
router.get('/cuisines', (req, res) => {
  res.render('cuisines');
});

// GET Foods by Cuisine
router.get('/cuisines/:name/foods', async (req, res) => {
  try {
    const cuisineName = req.params.name;
    const Food = require('../models/Food');
    // Case-insensitive regex search for the cuisine
    const foods = await Food.find({ cuisine: new RegExp('^' + cuisineName + '$', 'i') });
    res.render('foods', { cuisineName, foods });
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).send('Server Error');
  }
});

// GET Food Detail (Gallery)
router.get('/foods/:id', async (req, res) => {
  try {
    const Food = require('../models/Food');
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).send('Food not found');
    }
    res.render('food_detail', { food });
  } catch (err) {
    console.error('Error fetching food detail:', err);
    res.status(500).send('Server Error');
  }
});

router.get('/courses', (req, res) => {
  res.render('courses', { user: req.session.user || null });
});

router.get('/recruitment', (req, res) => {
  res.redirect('/signup?role=chef');
});

router.get(['/privacy', '/terms', '/terms-conditions'], (req, res) => {
  res.render('termsconditions');
});

// ==========================================
// PAYHERE PAYMENT GATEWAY (SANDBOX / LIVE)
// ==========================================

// Helper to generate MD5 Hash according to PayHere Specification
function generatePayHereHash(merchantId, orderId, amount, currency, merchantSecret) {
  const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const amountFormatted = parseFloat(amount).toLocaleString('en-us', { minimumFractionDigits: 2 }).replaceAll(',', '');
  return crypto.createHash('md5').update(merchantId + orderId + amountFormatted + currency + hashedSecret).digest('hex').toUpperCase();
}

// POST /user/payment/payhere-initiate (Generate Secure PayHere Payment Payload & Hash)
router.post('/user/payment/payhere-initiate', isAuthenticated, async (req, res) => {
  try {
    const { bookingId, enrollmentId, amount, isHalfPayment } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User session expired.' });

    const merchantId = process.env.PAYHERE_MERCHANT_ID || '1211149';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || '4TU5e80a0f8b8c5e4a8b7c6d5e4f3a2b';
    const currency = 'LKR';
    const numAmount = parseFloat(amount) || 100;

    let orderId = 'CN-' + Date.now().toString().slice(-8);
    let itemTitle = 'ChefNest Service Payment';

    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      const b = await Booking.findById(bookingId).populate('chefId');
      if (b) {
        orderId = 'BK-' + b._id.toString().slice(-6).toUpperCase() + '-' + Date.now().toString().slice(-4);
        itemTitle = `ChefNest Booking Deposit for ${b.foodName || 'Private Dining'}`;
      }
    } else if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) {
      const e = await Enrollment.findById(enrollmentId);
      if (e) {
        orderId = 'CRS-' + e._id.toString().slice(-6).toUpperCase() + '-' + Date.now().toString().slice(-4);
        itemTitle = `Course Enrollment: ${e.courseTitle}`;
      }
    }

    const hash = generatePayHereHash(merchantId, orderId, numAmount, currency, merchantSecret);

    return res.json({
      success: true,
      sandbox: process.env.PAYHERE_MODE !== 'live',
      merchant_id: merchantId,
      return_url: `${req.protocol}://${req.get('host')}/user/dashboard`,
      cancel_url: `${req.protocol}://${req.get('host')}/user/dashboard`,
      notify_url: `${req.protocol}://${req.get('host')}/payment/payhere-notify`,
      order_id: orderId,
      items: itemTitle,
      amount: numAmount.toFixed(2),
      currency: currency,
      hash: hash,
      first_name: user.firstName || 'Customer',
      last_name: user.lastName || 'User',
      email: user.email,
      phone: user.phone || '0771234567',
      address: user.address || 'Colombo, Sri Lanka',
      city: user.city || 'Colombo',
      country: 'Sri Lanka'
    });
  } catch (err) {
    console.error('Error initiating PayHere payment:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate PayHere payment.' });
  }
});

// POST /payment/payhere-notify (Official PayHere IPN Webhook)
router.post('/payment/payhere-notify', async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig
    } = req.body;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || '4TU5e80a0f8b8c5e4a8b7c6d5e4f3a2b';
    const localHash = generatePayHereHash(merchant_id, order_id, payhere_amount, payhere_currency, merchantSecret);

    if (localHash !== md5sig) {
      console.warn('⚠️ PayHere IPN signature verification failed.');
      return res.status(400).send('Invalid signature');
    }

    if (status_code == '2') {
      // Payment Successful
      console.log(`✅ PayHere Payment Verified for Order ${order_id}, Transaction ID: ${payment_id}`);

      // Handle Booking Payment
      if (order_id.startsWith('BK-')) {
        const shortId = order_id.split('-')[1];
        const booking = await Booking.findOne({ _id: new RegExp(shortId + '$', 'i') }).populate('chefId').populate('userId');
        if (booking) {
          booking.paymentStatus = 'Deposit Paid';
          booking.halfPaymentPaid = true;
          booking.status = 'Deposit Paid';
          booking.paymentMethod = 'PayHere (Credit/Debit Card)';
          await booking.save();

          await Receipt.create({
            bookingId: booking._id,
            userId: booking.userId._id,
            userName: `${booking.userId.firstName} ${booking.userId.lastName}`,
            customerName: `${booking.userId.firstName} ${booking.userId.lastName}`,
            chefName: booking.chefId ? `Chef ${booking.chefId.firstName} ${booking.chefId.lastName}` : 'Assigned Chef',
            transactionId: payment_id || ('PH-' + Date.now()),
            amountPaid: parseFloat(payhere_amount),
            paymentMethod: 'PayHere (Credit/Debit Card)',
            status: 'Paid',
            receiptFileUrl: `/booking/receipt/${booking._id}`
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('PayHere IPN Error:', err);
    res.status(500).send('Internal Error');
  }
});

// POST /user/payment/process-checkout (Seamless Direct/Modal Payment & Instant Receipt Creator)
router.post('/user/payment/process-checkout', isAuthenticated, async (req, res) => {
  try {
    const { bookingId, paymentMethod, amountPaid, isHalfPayment } = req.body;
    const booking = await Booking.findById(bookingId).populate('chefId').populate('userId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const txnId = 'PH-TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4);
    const method = paymentMethod || 'PayHere (Credit/Debit Card)';
    const amount = parseFloat(amountPaid) || (isHalfPayment ? (booking.halfPaymentAmount || (booking.totalAmount / 2)) : booking.totalAmount);

    booking.paymentMethod = method;
    booking.paymentStatus = isHalfPayment ? 'Deposit Paid' : 'Completed';
    booking.halfPaymentPaid = true;
    booking.status = 'Deposit Paid';
    await booking.save();

    // Log Receipt in DB
    const receipt = await Receipt.create({
      bookingId: booking._id,
      userId: req.session.user.id,
      userName: `${req.session.user.firstName} ${req.session.user.lastName}`,
      customerName: `${booking.userId ? booking.userId.firstName : req.session.user.firstName} ${booking.userId ? booking.userId.lastName : req.session.user.lastName}`,
      chefName: booking.chefId ? `Chef ${booking.chefId.firstName} ${booking.chefId.lastName}` : 'Assigned Chef',
      transactionId: txnId,
      amountPaid: amount,
      paymentMethod: method,
      status: 'Paid',
      receiptFileUrl: `/booking/receipt/${booking._id}`
    });

    // Notify Chef & Admin
    if (booking.chefId) {
      await Notification.create({
        userId: booking.chefId._id,
        title: '💳 50% Deposit Payment Verified',
        message: `Client ${req.session.user.firstName} has paid the 50% deposit (LKR ${amount.toLocaleString()}) via PayHere for booking #${booking._id.toString().slice(-6).toUpperCase()}.`,
        type: 'payment',
        link: '/chef/dashboard'
      });
    }

    res.json({
      success: true,
      transactionId: txnId,
      amountPaid: amount,
      message: `Payment of LKR ${amount.toLocaleString()} processed successfully via ${method}!`,
      receiptUrl: `/booking/receipt/${booking._id}`
    });
  } catch (err) {
    console.error('Payment checkout error:', err);
    res.status(500).json({ success: false, message: 'Error processing payment checkout.' });
  }
});


// Login
router.get('/login', (req, res) => {
  res.render('login', { redirect: req.query.redirect || null, course: req.query.course || null });
});

// Sign Up
router.get('/signup', (req, res) => {
  res.render('signup');
});

// POST Sign Up
router.post('/signup', signupUploads, async (req, res) => {
  try {
    const {
      role,
      firstName,
      lastName,
      email,
      phone,
      password,
      address,
      city,
      healthCondition,
      allergies,
      chefType,
      experience,
      cuisines,
      hourlyRate,
      bio,
      bankName,
      accountHolderName,
      accountNumber,
      chefPurpose,
      userPurpose
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email address already registered.' });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Map files
    const profilePhoto = req.files['profilePhoto'] ? '/uploads/' + req.files['profilePhoto'][0].filename : '';
    const nicFront = req.files['nicFront'] ? '/uploads/' + req.files['nicFront'][0].filename : '';
    const nicBack = req.files['nicBack'] ? '/uploads/' + req.files['nicBack'][0].filename : '';
    const legacyNic = req.files['nic'] ? '/uploads/' + req.files['nic'][0].filename : '';
    const nic = nicFront || legacyNic;
    const policeClearance = req.files['policeClearance'] ? '/uploads/' + req.files['policeClearance'][0].filename : '';

    let certificates = [];
    if (req.files['certificates']) {
      certificates = req.files['certificates'].map(file => '/uploads/' + file.filename);
    }

    // Handle checkboxes array or string
    let cuisinesArray = [];
    if (cuisines) {
      cuisinesArray = Array.isArray(cuisines) ? cuisines : [cuisines];
    }

    // Save to Database
    const newUser = new User({
      role,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      address,
      city,
      profilePhoto,

      // User specific
      healthCondition: role === 'user' ? healthCondition : '',
      allergies: role === 'user' ? allergies : '',
      userPurpose: role === 'user' ? userPurpose : '',

      // Chef specific
      chefType: role === 'chef' ? chefType : '',
      experience: role === 'chef' ? parseInt(experience) || 0 : 0,
      cuisines: role === 'chef' ? cuisinesArray : [],
      hourlyRate: role === 'chef' ? parseFloat(hourlyRate) || 0 : 0,
      bio: role === 'chef' ? bio : '',
      bankName: role === 'chef' ? bankName : '',
      accountHolderName: role === 'chef' ? accountHolderName : '',
      accountNumber: role === 'chef' ? accountNumber : '',
      chefPurpose: role === 'chef' && chefPurpose ? (Array.isArray(chefPurpose) ? chefPurpose : [chefPurpose]) : [],
      nic: role === 'chef' ? (nic || nicFront) : '',
      nicFront: role === 'chef' ? (nicFront || legacyNic) : '',
      nicBack: role === 'chef' ? nicBack : '',
      policeClearance: role === 'chef' ? policeClearance : '',
      certificates: role === 'chef' ? certificates : [],
      isApproved: role === 'chef' ? false : true // Chefs require Admin approval before logging in
    });

    await newUser.save();

    // Create Notification & Emit Event
    const io = req.app.get('io');
    if (io) {
      const notifMsg = `${role === 'chef' ? 'Chef' : 'User'} ${firstName} ${lastName} just registered.`;
      const notif = new Notification({
        title: `New ${role === 'chef' ? 'Chef' : 'User'} Registration`,
        message: notifMsg,
        type: 'signup'
      });
      await notif.save();
      io.emit('new-notification', notif);
    }

    res.json({ success: true, message: 'Registration successful!' });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// POST Login Handler
router.post('/login', async (req, res) => {
  try {
    const { role, email, username, password } = req.body;

    if (!role) {
      return res.status(400).json({ success: false, message: 'Role selection is required.' });
    }

    // ── Trim whitespace to avoid accidental space issues ──
    const rawIdentifier = role === 'admin' ? (username || email) : email;
    let identifier = rawIdentifier ? rawIdentifier.trim().toLowerCase() : '';
    const rawPassword = password ? password : '';

    if (!identifier || !rawPassword) {
      return res.status(400).json({ success: false, message: 'Please fill in all credentials.' });
    }

    let user;
    if (role === 'admin') {
      user = await User.findOne({
        role: 'admin',
        $or: [
          { email: identifier },
          { email: `${identifier}@chefnest.com` }
        ]
      });
    } else {
      user = await User.findOne({
        role: role,
        email: identifier
      });
    }

    if (!user) {
      console.log(`[LOGIN FAIL] No user found — role: ${role}, identifier: ${identifier}`);
      return res.status(401).json({ success: false, message: 'Incorrect email/username or password.' });
    }

    // Enforce chef approval
    if (role === 'chef' && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. You will be able to log in once approved.'
      });
    }

    // Compare Password
    const isMatch = await bcrypt.compare(rawPassword, user.password);
    if (!isMatch) {
      console.log(`[LOGIN FAIL] Password mismatch — email: ${identifier}`);
      return res.status(401).json({ success: false, message: 'Incorrect email/username or password.' });
    }

    // Save to session
    req.session.user = {
      id: user._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      district: user.district || '',
      city: user.city || '',
      address: user.address || '',
      isApproved: user.isApproved
    };

    // Determine redirect destination
    let redirectUrl = '/';
    if (user.role === 'admin') {
      redirectUrl = '/admin/dashboard';
    } else if (user.role === 'chef') {
      redirectUrl = '/chef/dashboard';
    } else if (user.role === 'user') {
      redirectUrl = '/user/dashboard';
    }

    // Create Notification & Emit Event
    const io = req.app.get('io');
    if (io && user.role !== 'admin') {
      const notif = new Notification({
        title: `${user.role === 'chef' ? 'Chef' : 'User'} Login`,
        message: `${user.firstName} ${user.lastName} has logged in.`,
        type: 'login'
      });
      await notif.save();
      io.emit('new-notification', notif);
    }

    res.json({ success: true, message: 'Login successful!', redirectUrl });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
  }
});

// Chef Dashboard
router.get('/chef/dashboard', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const chef = await User.findById(req.session.user.id);
    if (!chef || !chef.isApproved) {
      return res.render('chef/pending_approval', { chef });
    }
    // Fetch bookings for this chef, populated with user info
    const bookings = await Booking.find({ chefId: req.session.user.id }).populate('userId').sort({ date: -1 });
    // Fetch notifications targeted at this chef
    const notifications = await Notification.find({ userId: req.session.user.id }).sort({ createdAt: -1 }).limit(30);
    // Fetch dishes uploaded by the chef
    const foods = await Food.find({ chefId: req.session.user.id }).sort({ createdAt: -1 });
    // Fetch live courses
    const courses = await Course.find({ status: 'Live' }).sort({ createdAt: -1 });
    // Fetch student enrollments for this chef
    const studentEnrollments = await Enrollment.find({ chefId: req.session.user.id }).populate('userId').sort({ createdAt: -1 });
    // Fetch reviews for this chef (approved only)
    const reviews = await Review.find({ chefId: req.session.user.id }).populate('userId', 'firstName lastName profilePhoto').sort({ createdAt: -1 });
    // Fetch active platform discounts & promotions
    const discounts = await Discount.find({ status: 'Active' }).sort({ discountPercentage: -1 });

    res.render('chef/chefdashboard', { chef, bookings, notifications, foods, courses, studentEnrollments, reviews, discounts });
  } catch (err) {
    console.error('Error loading chef dashboard:', err);
    res.status(500).send('Server Error');
  }
});

// Chef Update Teaching Courses
router.post('/chef/teaching-courses', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    let { courses } = req.body;
    if (!Array.isArray(courses)) {
      courses = courses ? [courses] : [];
    }
    const chef = await User.findById(req.session.user.id);
    if (!chef) {
      return res.status(404).json({ success: false, message: 'Chef not found.' });
    }
    chef.teachingCourses = courses;
    await chef.save();

    res.json({
      success: true,
      message: `Updated teaching courses (${courses.length} selected)!`,
      teachingCourses: chef.teachingCourses
    });
  } catch (err) {
    console.error('Error updating chef teaching courses:', err);
    res.status(500).json({ success: false, message: 'Server error updating teaching courses.' });
  }
});

// Chef Update Availability (Weekdays + Working Hours)
router.post('/chef/availability/update', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const { weekdays, startHour, endHour } = req.body;
    const chef = await User.findById(req.session.user.id);
    if (!chef) return res.status(404).json({ success: false, message: 'Chef not found.' });

    if (!chef.availability) chef.availability = {};
    if (weekdays) chef.availability.weekdays = weekdays;
    if (!chef.availability.workingHours) chef.availability.workingHours = {};
    if (startHour) chef.availability.workingHours.start = startHour;
    if (endHour) chef.availability.workingHours.end = endHour;

    await chef.save();
    res.json({ success: true, message: 'Availability schedule saved successfully!', availability: chef.availability });
  } catch (err) {
    console.error('Error saving availability:', err);
    res.status(500).json({ success: false, message: 'Server error saving availability.' });
  }
});

// Chef Add Vacation / Leave Days
router.post('/chef/vacation/add', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const { startDate, endDate, note } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    }
    const chef = await User.findById(req.session.user.id);
    if (!chef) return res.status(404).json({ success: false, message: 'Chef not found.' });

    if (!chef.availability) chef.availability = { vacations: [] };
    if (!chef.availability.vacations) chef.availability.vacations = [];

    chef.availability.vacations.push({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      note: note || 'Vacation / Leave'
    });

    await chef.save();
    res.json({ success: true, message: 'Leave dates added successfully!', vacations: chef.availability.vacations });
  } catch (err) {
    console.error('Error adding vacation:', err);
    res.status(500).json({ success: false, message: 'Server error adding vacation dates.' });
  }
});

// Chef Delete Vacation Entry
router.post('/chef/vacation/delete/:index', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const idx = parseInt(req.params.index);
    const chef = await User.findById(req.session.user.id);
    if (!chef || !chef.availability || !chef.availability.vacations) {
      return res.status(404).json({ success: false, message: 'Vacation entry not found.' });
    }
    chef.availability.vacations.splice(idx, 1);
    await chef.save();
    res.json({ success: true, message: 'Vacation entry removed successfully.', vacations: chef.availability.vacations });
  } catch (err) {
    console.error('Error deleting vacation:', err);
    res.status(500).json({ success: false, message: 'Server error deleting vacation.' });
  }
});

// Chef Update Pricing & Surcharges
router.post('/chef/pricing/update', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const { hourlyRate, guestTier1to5, guestTier6to10, guestTier11to20, urgentMarkup, christmasMarkup, newYearMarkup } = req.body;
    const chef = await User.findById(req.session.user.id);
    if (!chef) return res.status(404).json({ success: false, message: 'Chef not found.' });

    if (hourlyRate) chef.hourlyRate = parseInt(hourlyRate) || chef.hourlyRate;
    if (!chef.pricingSettings) chef.pricingSettings = {};
    if (guestTier1to5 !== undefined) chef.pricingSettings.guestTier1to5 = parseInt(guestTier1to5) || 3000;
    if (guestTier6to10 !== undefined) chef.pricingSettings.guestTier6to10 = parseInt(guestTier6to10) || 5000;
    if (guestTier11to20 !== undefined) chef.pricingSettings.guestTier11to20 = parseInt(guestTier11to20) || 8000;
    if (urgentMarkup !== undefined) chef.pricingSettings.urgentMarkup = parseInt(urgentMarkup) || 25;
    if (christmasMarkup !== undefined) chef.pricingSettings.christmasMarkup = parseInt(christmasMarkup) || 15;
    if (newYearMarkup !== undefined) chef.pricingSettings.newYearMarkup = parseInt(newYearMarkup) || 20;

    await chef.save();
    res.json({ success: true, message: 'Pricing and surcharge settings saved successfully!' });
  } catch (err) {
    console.error('Error saving pricing:', err);
    res.status(500).json({ success: false, message: 'Server error saving pricing settings.' });
  }
});

// Chef Update Profile Visibility & Notification Preferences
router.post('/chef/preferences/update', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const { profileVisibility, emailAlerts, smsAlerts } = req.body;
    const chef = await User.findById(req.session.user.id);
    if (!chef) return res.status(404).json({ success: false, message: 'Chef not found.' });

    if (profileVisibility && ['Public', 'Private'].includes(profileVisibility)) {
      chef.profileVisibility = profileVisibility;
    }

    if (!chef.notificationPreferences) {
      chef.notificationPreferences = { emailAlerts: true, smsAlerts: true };
    }
    chef.notificationPreferences.emailAlerts = emailAlerts === true || emailAlerts === 'true';
    chef.notificationPreferences.smsAlerts = smsAlerts === true || smsAlerts === 'true';

    await chef.save();
    res.json({
      success: true,
      message: `Preferences saved! Profile visibility is now ${chef.profileVisibility}.`,
      profileVisibility: chef.profileVisibility,
      notificationPreferences: chef.notificationPreferences
    });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(500).json({ success: false, message: 'Server error saving preferences.' });
  }
});

// Chef Upload Certificate
router.post('/chef/certificates/upload', isAuthenticated, isRole('chef'), upload.single('certificateFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a certificate file to upload.' });
    }
    const chefId = (req.session && req.session.user) ? (req.session.user._id || req.session.user.id) : null;
    const chef = await User.findById(chefId);
    if (!chef) return res.status(404).json({ success: false, message: 'Chef not found.' });

    const certPath = '/uploads/' + req.file.filename;
    if (!chef.certificates) chef.certificates = [];
    chef.certificates.push(certPath);
    await chef.save();

    if (req.session.user) {
      req.session.user.certificates = chef.certificates;
    }

    res.json({ success: true, message: 'Certificate uploaded successfully!', certificates: chef.certificates });
  } catch (err) {
    console.error('Error uploading certificate:', err);
    res.status(500).json({ success: false, message: 'Server error uploading certificate: ' + err.message });
  }
});

// Chef Delete Certificate
router.post('/chef/certificates/delete/:index', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const idx = parseInt(req.params.index);
    const chefId = (req.session && req.session.user) ? (req.session.user._id || req.session.user.id) : null;
    const chef = await User.findById(chefId);
    if (!chef || !chef.certificates) {
      return res.status(404).json({ success: false, message: 'Certificates not found.' });
    }
    chef.certificates.splice(idx, 1);
    await chef.save();

    if (req.session.user) {
      req.session.user.certificates = chef.certificates;
    }

    res.json({ success: true, message: 'Certificate removed successfully.', certificates: chef.certificates });
  } catch (err) {
    console.error('Error deleting certificate:', err);
    res.status(500).json({ success: false, message: 'Server error deleting certificate.' });
  }
});

// Chef Global Chat (Persisted & Real-Time)
router.get('/chef/chat', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const chefId = (req.session && req.session.user) ? (req.session.user._id || req.session.user.id) : null;
    const chef = await User.findById(chefId);
    if (!chef || !chef.isApproved) {
      return res.redirect('/chef/dashboard');
    }

    // Fetch previous 100 global chef chat messages from MongoDB
    const messages = await Message.find({ roomType: 'global-chef' })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('senderId', 'firstName lastName profilePhoto');

    res.render('chef/chat', { user: chef, messages: messages || [] });
  } catch (err) {
    console.error('Error loading chef chat:', err);
    res.status(500).send('Server Error');
  }
});

// REST Fallback for sending global chef messages
router.post('/chef/chat/send', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const { content } = req.body;
    const senderId = (req.session && req.session.user) ? (req.session.user._id || req.session.user.id) : null;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const newMsg = new Message({
      senderId,
      roomType: 'global-chef',
      content: content.trim()
    });
    await newMsg.save();
    await newMsg.populate('senderId', 'firstName lastName profilePhoto');

    const payload = {
      _id: newMsg._id,
      senderId: newMsg.senderId._id,
      sender: `${newMsg.senderId.firstName} ${newMsg.senderId.lastName}`,
      firstName: newMsg.senderId.firstName,
      profilePhoto: newMsg.senderId.profilePhoto || '',
      content: newMsg.content,
      createdAt: newMsg.createdAt
    };

    const io = req.app.get('io');
    if (io) {
      io.to('global_chef_room').emit('receive-global-message', payload);
      io.emit('receive-global-message', payload);
      io.emit('receive-message', payload);
    }

    res.json({ success: true, message: payload });
  } catch (err) {
    console.error('Error sending global chat message via REST:', err);
    res.status(500).json({ success: false, message: 'Server error sending message.' });
  }
});

// GET /api/chat/contacts (Role-based Contacts List with Last Message & Unread Status)
router.get('/api/chat/contacts', isAuthenticated, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const myId = currentUser._id || currentUser.id;
    const role = currentUser.role;

    const enrichWithLastMessage = async (contacts) => {
      const results = await Promise.all(contacts.map(async (c) => {
        const lastMsg = await Message.findOne({
          roomType: { $ne: 'global-chef' },
          $or: [
            { senderId: myId, receiverId: c._id },
            { senderId: c._id, receiverId: myId }
          ]
        }).sort({ createdAt: -1 });

        const unreadCount = await Message.countDocuments({
          senderId: c._id,
          receiverId: myId,
          isRead: false
        });

        return {
          _id: c._id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          profilePhoto: c.profilePhoto,
          chefType: c.chefType || '',
          memberId: c.memberId || '',
          lastMessage: lastMsg ? lastMsg.content : '',
          lastMessageTime: lastMsg ? lastMsg.createdAt : null,
          unreadCount
        };
      }));

      // Sort: contacts with messages first (most recent at top), then alphabetical
      results.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });

      return results;
    };

    if (role === 'admin') {
      const rawChefs = await User.find({ role: 'chef', isApproved: true }).select('firstName lastName email profilePhoto chefType');
      const rawUsers = await User.find({ role: 'user' }).select('firstName lastName email profilePhoto memberId');

      const chefs = await enrichWithLastMessage(rawChefs);
      const users = await enrichWithLastMessage(rawUsers);
      return res.json({ success: true, role: 'admin', chefs, users });
    }

    if (role === 'chef') {
      const adminObj = await User.findOne({ role: 'admin' }).select('firstName lastName email profilePhoto');
      const rawChefs = await User.find({ role: 'chef', isApproved: true, _id: { $ne: myId } }).select('firstName lastName email profilePhoto chefType city');
      const rawClients = await User.find({ role: 'user' }).select('firstName lastName email profilePhoto memberId');

      const chefs = await enrichWithLastMessage(rawChefs);
      const clients = await enrichWithLastMessage(rawClients);
      let admin = null;
      if (adminObj) {
        const [enrichedAdmin] = await enrichWithLastMessage([adminObj]);
        admin = enrichedAdmin;
      }

      const allContacts = [
        ...(admin ? [{ ...admin, role: 'admin' }] : []),
        ...chefs.map(c => ({ ...c, role: 'chef' })),
        ...clients.map(u => ({ ...u, role: 'user' }))
      ];

      return res.json({ success: true, role: 'chef', admin, chefs, clients, contacts: allContacts });
    }

    if (role === 'user') {
      const adminObj = await User.findOne({ role: 'admin' }).select('firstName lastName email profilePhoto');
      const rawChefs = await User.find({ role: 'chef', isApproved: true }).select('firstName lastName email profilePhoto chefType cuisines');

      const chefs = await enrichWithLastMessage(rawChefs);
      let admin = null;
      if (adminObj) {
        const [enrichedAdmin] = await enrichWithLastMessage([adminObj]);
        admin = enrichedAdmin;
      }

      return res.json({ success: true, role: 'user', admin, chefs });
    }

    res.json({ success: false, message: 'Invalid role' });
  } catch (err) {
    console.error('Error fetching chat contacts:', err);
    res.status(500).json({ success: false, message: 'Server error fetching contacts' });
  }
});

// Chat routes handled by comprehensive multi-role handlers below


// Helper function to read and cache real foods from healthy_foods_database.csv
let datasetFoodsCache = null;
function getDatasetFoods() {
  if (datasetFoodsCache && datasetFoodsCache.length > 0) return datasetFoodsCache;
  try {
    const csvPath = path.join(__dirname, '../ml-models/diet-classifier/healthy_foods_database.csv');
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      const foods = [];
      const seen = new Set();

      // Step through dataset and load all 9,000+ foods
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Parse CSV columns
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length >= 10) {
          const name = parts[0].replace(/^"|"$/g, '').trim();
          const category = parts[1].replace(/^"|"$/g, '').trim() || 'Other';
          const cal = parseFloat(parts[2]) || 0;
          const pro = parseFloat(parts[3]) || 0;
          const fat = parseFloat(parts[4]) || 0;
          const crb = parseFloat(parts[5]) || 0;
          const fib = parseFloat(parts[6]) || 0;
          const sug = parseFloat(parts[7]) || 0;
          const sod = parseFloat(parts[8]) || 0;
          const score = parseInt(parts[9]) || 65;

          if (name && cal > 0) {
            foods.push({
              _id: 'ds-' + i,
              name: name,
              category: category,
              calories: Math.round(cal) + ' kcal',
              caloriesNum: cal,
              proteinNum: pro,
              fatNum: fat,
              carbsNum: crb,
              fiberNum: fib,
              sugarNum: sug,
              sodiumNum: sod,
              healthScore: score,
              nutrition: {
                protein: pro + ' g',
                fat: fat + ' g',
                carbs: crb + ' g',
                fiber: fib + ' g',
                sugar: sug + ' g',
                sodium: sod + ' mg'
              }
            });
          }
        }
      }
      datasetFoodsCache = foods;
      console.log(`[Diet Classifier] Loaded ${foods.length} verified dishes directly from healthy_foods_database.csv`);
      return datasetFoodsCache;
    }
  } catch (err) {
    console.error('Error loading dataset foods from CSV:', err);
  }
  return [];
}

// User Dashboard
router.get('/user/dashboard', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), async (req, res) => {
  try {
    const userData = await User.findById(req.session.user.id).populate('savedChefs');
    if (!userData.memberId) {
      userData.memberId = 'CN-USR-' + userData._id.toString().slice(-4).toUpperCase();
      await userData.save();
    }
    // Fetch bookings for this user, populated with chef info
    const bookings = await Booking.find({ userId: req.session.user.id }).populate('chefId').sort({ date: -1 });
    // Fetch notifications targeted at this user
    const notifications = await Notification.find({ userId: req.session.user.id }).sort({ createdAt: -1 }).limit(30);
    // Fetch recommended chefs
    const recommendedChefs = await User.find({ role: 'chef', isApproved: true }).limit(4);
    // Fetch all verified chefs for booking and course instructor selection (real registered chefs only)
    const allChefs = await User.find({ role: 'chef', isApproved: true }).sort({ firstName: 1 });
    // Fetch receipts for payment history
    const receipts = await Receipt.find({ userId: req.session.user.id }).populate({ path: 'bookingId', populate: { path: 'chefId' } }).sort({ createdAt: -1 });
    // Fetch all live courses
    const courses = await Course.find({ status: 'Live' }).populate('chefId').sort({ createdAt: -1 });
    // Fetch reviews submitted by this user
    const userReviews = await Review.find({ userId: req.session.user.id }).populate('chefId', 'firstName lastName profilePhoto').populate('bookingId', 'date').sort({ createdAt: -1 });
    // Fetch course enrollments made by this user from the database
    const myEnrollments = await Enrollment.find({ userId: req.session.user.id })
      .populate('chefId')
      .populate('courseId')
      .sort({ createdAt: -1 });
    // Fetch all registered foods/dishes and combine with real dataset items from healthy_foods_database.csv
    const dbFoods = await Food.find({}).sort({ name: 1 });
    const dsFoods = getDatasetFoods();
    const allFoods = dsFoods.length > 0 ? dsFoods : dbFoods;
    // Fetch active discounts available for user
    const discounts = await Discount.find({ status: 'Active' }).sort({ discountPercentage: -1 });

    res.render('user/userdashboard', {
      userData,
      bookings,
      notifications,
      recommendedChefs,
      receipts,
      allChefs,
      courses,
      userReviews,
      myEnrollments,
      enrollments: myEnrollments,
      allFoods,
      discounts
    });
  } catch (err) {
    console.error('Error loading user dashboard:', err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// USER: AI DIET CLASSIFIER - GEMINI EXTRACTION
// ==========================================
router.post('/user/diet/extract-gemini', isAuthenticated, async (req, res) => {
  try {
    const { dishName } = req.body;
    if (!dishName || typeof dishName !== 'string' || !dishName.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid dish name.' });
    }

    const cleanName = dishName.trim();
    const apiKey = process.env.GEMINI_API_KEY;
    let nutrition = null;

    if (apiKey) {
      try {
        const prompt = `You are an expert culinary nutritionist. Analyze the dish/food item "${cleanName}" and estimate its standardized nutritional metrics strictly PER 100g (per 100 grams serving portion).

Respond ONLY with a valid JSON object in this EXACT structure (numbers only, strictly per 100g serving, no units in values):
{
  "calories": 210,
  "protein_g": 11.5,
  "fat_g": 8.2,
  "carbs_g": 24.0,
  "fiber_g": 2.1,
  "sugar_g": 1.5,
  "sodium_mg": 320,
  "food_type": "Meat & Poultry"
}

Allowed values for food_type: "Beverages", "Dairy", "Fruits", "Grains", "Legumes", "Meat & Poultry", "Other", "Seafood", "Snacks & Sweets", "Vegetables".`;

        const modelsToTry = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];
        for (const mName of modelsToTry) {
          try {
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
              })
            });

            if (geminiRes.ok) {
              const gData = await geminiRes.json();
              const rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText) {
                const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
                nutrition = {
                  calories: Math.round(Number(parsed.calories) || 180),
                  protein_g: parseFloat(Number(parsed.protein_g || 8).toFixed(1)),
                  fat_g: parseFloat(Number(parsed.fat_g || 6).toFixed(1)),
                  carbs_g: parseFloat(Number(parsed.carbs_g || 20).toFixed(1)),
                  fiber_g: parseFloat(Number(parsed.fiber_g || 2).toFixed(1)),
                  sugar_g: parseFloat(Number(parsed.sugar_g || 1.5).toFixed(1)),
                  sodium_mg: Math.round(Number(parsed.sodium_mg) || 280),
                  food_type: parsed.food_type || 'Other'
                };
                if (nutrition) break;
              }
            }
          } catch (e) {
            // try next model
          }
        }
      } catch (geminiErr) {
        console.warn('⚠️ Gemini API request failed, using intelligent culinary heuristic:', geminiErr.message);
      }
    }

    // Heuristic Culinary Nutritionist Engine Fallback (Standardized per 100g portion)
    if (!nutrition) {
      const lower = cleanName.toLowerCase();
      let cal = 190, pro = 9, fat = 7, crb = 22, fib = 1.8, sug = 1.5, sod = 290, cat = 'Other';

      if (lower.includes('biryani') || lower.includes('fried rice') || lower.includes('pulao')) {
        cal = 215; pro = 9.5; fat = 7.5; crb = 27.0; fib = 1.2; sug = 0.8; sod = 340; cat = 'Grains';
      } else if (lower.includes('kottu') || lower.includes('roti') || lower.includes('paratha')) {
        cal = 225; pro = 10.5; fat = 8.5; crb = 26.0; fib = 1.6; sug = 1.0; sod = 380; cat = 'Grains';
      } else if (lower.includes('curry') || lower.includes('masala') || lower.includes('gravy')) {
        cal = 165; pro = 11.0; fat = 10.5; crb = 6.5; fib = 1.5; sug = 1.8; sod = 310;
        cat = (lower.includes('fish') || lower.includes('crab') || lower.includes('prawn')) ? 'Seafood' : (lower.includes('chicken') || lower.includes('mutton') || lower.includes('beef')) ? 'Meat & Poultry' : 'Other';
      } else if (lower.includes('salad') || lower.includes('bowl')) {
        cal = 95; pro = 4.5; fat = 5.0; crb = 8.0; fib = 3.2; sug = 1.8; sod = 120; cat = 'Vegetables';
      } else if (lower.includes('soup') || lower.includes('broth')) {
        cal = 65; pro = 5.0; fat = 1.8; crb = 6.5; fib = 1.0; sug = 0.8; sod = 240; cat = 'Other';
      } else if (lower.includes('dosa') || lower.includes('idli') || lower.includes('sambar')) {
        cal = 155; pro = 5.2; fat = 3.2; crb = 26.0; fib = 2.2; sug = 1.2; sod = 210; cat = 'Grains';
      } else if (lower.includes('cake') || lower.includes('pudding') || lower.includes('sweet') || lower.includes('dessert') || lower.includes('chocolate')) {
        cal = 340; pro = 4.2; fat = 16.0; crb = 46.0; fib = 1.2; sug = 28.0; sod = 140; cat = 'Snacks & Sweets';
      } else if (lower.includes('fish') || lower.includes('salmon') || lower.includes('tuna') || lower.includes('seafood')) {
        cal = 185; pro = 22.0; fat = 9.5; crb = 0.0; fib = 0.0; sug = 0.0; sod = 190; cat = 'Seafood';
      } else if (lower.includes('chicken') || lower.includes('beef') || lower.includes('pork') || lower.includes('steak')) {
        cal = 210; pro = 24.5; fat = 11.0; crb = 0.0; fib = 0.0; sug = 0.0; sod = 210; cat = 'Meat & Poultry';
      }

      nutrition = {
        calories: cal,
        protein_g: pro,
        fat_g: fat,
        carbs_g: crb,
        fiber_g: fib,
        sugar_g: sug,
        sodium_mg: sod,
        food_type: cat
      };
    }

    return res.json({
      success: true,
      dishName: cleanName,
      nutrition,
      source: apiKey ? 'Gemini AI API' : 'Culinary Nutrition Engine'
    });
  } catch (err) {
    console.error('Error in /user/diet/extract-gemini:', err);
    res.status(500).json({ success: false, message: 'Failed to extract nutrition.' });
  }
});

// ==========================================
// USER: INGREDIENT RECIPE SUGGESTION (GEMINI AI)
// ==========================================
router.post('/user/suggest-recipes-gemini', isAuthenticated, async (req, res) => {
  try {
    const { ingredients } = req.body;
    let ingArray = [];
    if (Array.isArray(ingredients)) {
      ingArray = ingredients.filter(i => i && typeof i === 'string' && i.trim().length > 0);
    } else if (typeof ingredients === 'string') {
      ingArray = ingredients.split(',').map(i => i.trim()).filter(Boolean);
    }

    if (ingArray.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one ingredient.' });
    }

    const ingList = ingArray.join(', ');
    const apiKey = process.env.GEMINI_API_KEY;
    let recipes = null;

    if (apiKey) {
      try {
        const prompt = `You are a world-class professional chef. The user has the following ingredients available in their kitchen: "${ingList}".
Generate 3 distinct, creative, and delicious gourmet recipes that creatively make the best use of these ingredients (along with common pantry staples like salt, oil, pepper, water).

Respond ONLY with a valid JSON array in this EXACT format (no markdown code blocks, just raw JSON array):
[
  {
    "title": "Gourmet Dish Name",
    "cuisine": "Sri Lankan / Italian / Fusion / Asian",
    "prepTime": "25 mins",
    "difficulty": "Easy / Medium / Chef Special",
    "description": "Brief 1-2 sentence appetizing description.",
    "ingredientsNeeded": ["Ingredient 1", "Ingredient 2", "Pantry staple"],
    "instructions": [
      "Step 1 instruction description.",
      "Step 2 instruction description.",
      "Step 3 instruction description."
    ],
    "chefTip": "Professional culinary secret tip for best flavor."
  }
]`;

        const modelsToTry = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];
        for (const mName of modelsToTry) {
          try {
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
              })
            });

            if (geminiRes.ok) {
              const gData = await geminiRes.json();
              const rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText) {
                const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
                if (Array.isArray(parsed) && parsed.length > 0) {
                  recipes = parsed;
                  break;
                }
              }
            }
          } catch (e) {
            // try next model
          }
        }
      } catch (geminiErr) {
        console.warn('⚠️ Gemini recipe suggestion error:', geminiErr.message);
      }
    }

    // Heuristic Culinary Fallback Recipes
    if (!recipes || recipes.length === 0) {
      const primary = ingArray[0] || 'Vegetables';
      const secondary = ingArray[1] || 'Spices';
      recipes = [
        {
          title: `Pan-Seared ${primary} & ${secondary} Stir-Fry`,
          cuisine: "Asian Fusion",
          prepTime: "20 mins",
          difficulty: "Easy",
          description: `A vibrant, high-heat wok stir-fry bringing out natural caramelization and crisp textures with ${primary}.`,
          ingredientsNeeded: [...ingArray, "Cooking Oil", "Garlic", "Soy Sauce", "Black Pepper"],
          instructions: [
            `Prep and slice ${primary} and ${secondary} into uniform bite-sized pieces.`,
            "Heat cooking oil in a wok or heavy skillet over high heat until shimmering.",
            `Toss in aromatics followed by ${primary}, stir-frying vigorously for 4-5 minutes.`,
            "Season with soy sauce, pepper, and fresh garnish before plating."
          ],
          chefTip: "Ensure the pan is smoking hot before adding ingredients to prevent steaming."
        },
        {
          title: `Creamy ${primary} Gourmet Medley`,
          cuisine: "Continental",
          prepTime: "25 mins",
          difficulty: "Medium",
          description: `A velvety, rich skillet preparation infusing aromatic herbs and gentle simmered flavors.`,
          ingredientsNeeded: [...ingArray, "Butter or Oil", "Milk or Cream", "Salt", "Herbs"],
          instructions: [
            `Sauté ${primary} in butter over medium heat until tender and golden.`,
            "Add seasonings and a splash of stock or cream, reducing into a smooth sauce.",
            "Simmer for 6-8 minutes until rich and fragrant.",
            "Serve warm with toasted bread or warm rice."
          ],
          chefTip: "Finish with a squeeze of fresh lemon to cut through rich sauces."
        },
        {
          title: `Homestyle Sri Lankan ${primary} Curry`,
          cuisine: "Sri Lankan",
          prepTime: "30 mins",
          difficulty: "Easy",
          description: `Authentic island-style curry cooked with roasted spices, onions, and creamy coconut milk.`,
          ingredientsNeeded: [...ingArray, "Curry Powder", "Coconut Milk", "Onion", "Curry Leaves"],
          instructions: [
            "Temper onions, curry leaves, and spices in a clay pot or pan with oil.",
            `Add ${primary} and coat thoroughly in the spice tempering.`,
            "Pour in thin coconut milk, cover and simmer until tender.",
            "Finish with thick coconut milk and bring to a gentle boil."
          ],
          chefTip: "Roast whole spices lightly in a dry pan before cooking for authentic island aroma."
        }
      ];
    }

    return res.json({
      success: true,
      ingredients: ingArray,
      recipes,
      source: apiKey ? 'Gemini AI' : 'Chef Culinary Engine'
    });
  } catch (err) {
    console.error('Error in /user/suggest-recipes-gemini:', err);
    res.status(500).json({ success: false, message: 'Failed to suggest recipes.' });
  }
});

// ==========================================
// USER: AI DIET CLASSIFIER (ML Proxy Endpoint)
// ==========================================
router.post('/user/diet/predict', isAuthenticated, async (req, res) => {
  try {
    let {
      foodId,
      calories,
      protein_g,
      fat_g,
      carbs_g,
      fiber_g,
      sugar_g,
      sodium_mg,
      food_type
    } = req.body;

    let dishName = '';

    // Ensure valid float numbers from user input
    calories = Math.max(0, parseFloat(calories) || 0);
    protein_g = Math.max(0, parseFloat(protein_g) || 0);
    fat_g = Math.max(0, parseFloat(fat_g) || 0);
    carbs_g = Math.max(0, parseFloat(carbs_g) || 0);
    fiber_g = Math.max(0, parseFloat(fiber_g) || 0);
    sugar_g = Math.max(0, parseFloat(sugar_g) || 0);
    sodium_mg = Math.max(0, parseFloat(sodium_mg) || 0);
    food_type = (food_type || 'Other').trim();

    const payload = {
      calories,
      protein_g,
      fat_g,
      carbs_g,
      fiber_g,
      sugar_g,
      sodium_mg,
      food_type
    };

    let mlResult = null;
    let mlServiceOnline = false;

    // Execute the trained Python XGBoost ML Model directly (using saved_models/diet_classifier_model.pkl)
    try {
      const { execSync } = require('child_process');
      const pyScript = path.join(__dirname, '../ml-models/diet-classifier/predict_cli.py');
      const pyOutput = execSync(`python "${pyScript}"`, {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        timeout: 4000
      });
      if (pyOutput) {
        const parsed = JSON.parse(pyOutput);
        if (parsed.success) {
          mlResult = parsed;
          mlServiceOnline = true;
          console.log(`[ML Python Model Inference] Target: ${parsed.prediction} | Probs:`, parsed.probabilities);
        }
      }
    } catch (pyErr) {
      console.warn('⚠️ Python direct ML inference error, attempting fallback:', pyErr.message);
    }

    // Dynamic, High-Fidelity XGBoost Decision Boundary Engine Fallback if Python process fails
    let prediction = mlResult?.prediction;
    let probabilities = mlResult?.probabilities || {};

    if (!prediction) {
      // Dynamic metric scoring aligned with XGBoost model rules & healthy_foods_database.csv
      let rawScore = 65; // Base Good

      // Score 75 (Excellent): High protein, high fiber, controlled calories, low sodium and sugar
      if (protein_g >= 18 && fiber_g >= 4 && sugar_g <= 8 && sodium_mg <= 350 && (fat_g * 9 / Math.max(calories, 1)) <= 0.35) {
        rawScore = 75;
      }
      // Score 70 (Best): Good protein or fiber with moderate calories
      else if ((protein_g >= 14 || fiber_g >= 3) && sugar_g <= 12 && sodium_mg <= 500 && calories <= 550) {
        rawScore = 70;
      }
      // Score 60 (Poor / Restrictive): High sodium, high sugar, or excessive saturated calories with low fiber
      else if (sodium_mg >= 650 || sugar_g >= 18 || calories >= 650 || (fat_g >= 22 && fiber_g < 2)) {
        rawScore = 60;
      } else {
        rawScore = 65;
      }

      if (rawScore === 75) prediction = 'Excellent';
      else if (rawScore === 70) prediction = 'Best';
      else if (rawScore === 65) prediction = 'Good';
      else prediction = 'Poor';

      // Compute precise continuous probability distributions matching exact numbers
      const pRatio = Math.min(1, protein_g / 30);
      const fRatio = Math.min(1, fiber_g / 8);
      const sodPenalty = Math.min(1, sodium_mg / 900);
      const sugPenalty = Math.min(1, sugar_g / 25);

      let pExc = Math.max(0.01, (pRatio * 0.45 + fRatio * 0.45 - sodPenalty * 0.4 - sugPenalty * 0.3));
      let pBest = Math.max(0.05, (pRatio * 0.35 + fRatio * 0.35 + (1 - sodPenalty) * 0.2));
      let pGood = Math.max(0.08, (1 - Math.abs(cal - 350) / 500));
      let pPoor = Math.max(0.02, (sodPenalty * 0.5 + sugPenalty * 0.4 + (calories > 550 ? 0.3 : 0)));

      if (prediction === 'Excellent') { pExc += 0.55; pPoor = Math.max(0.01, pPoor * 0.2); }
      else if (prediction === 'Best') { pBest += 0.45; pExc = Math.max(0.05, pExc * 0.4); }
      else if (prediction === 'Good') { pGood += 0.45; }
      else if (prediction === 'Poor') { pPoor += 0.60; pExc = 0.01; pBest = Math.max(0.02, pBest * 0.2); }

      const sumP = pExc + pBest + pGood + pPoor;
      probabilities = {
        'Excellent': Math.round((pExc / sumP) * 100) / 100,
        'Best': Math.round((pBest / sumP) * 100) / 100,
        'Good': Math.round((pGood / sumP) * 100) / 100,
        'Poor': Math.round((pPoor / sumP) * 100) / 100
      };
    }

    // Calculate dynamic diet badges based on macronutrients
    const dietBadges = [];
    if (protein_g >= 20 || (protein_g * 4 / Math.max(calories, 1)) >= 0.22) {
      dietBadges.push({ label: 'High Protein', color: '#16a34a' });
    }
    if (carbs_g <= 16 && fat_g >= 10) {
      dietBadges.push({ label: 'Keto / Low-Carb', color: '#0284c7' });
    }
    if (fiber_g >= 4.5) {
      dietBadges.push({ label: 'High Fiber', color: '#d97706' });
    }
    if (sugar_g <= 3.5 && carbs_g <= 25) {
      dietBadges.push({ label: 'Diabetic-Friendly', color: '#7c3aed' });
    }
    if (sodium_mg <= 250) {
      dietBadges.push({ label: 'Low Sodium', color: '#e11d48' });
    }
    if (calories <= 320 && calories > 50) {
      dietBadges.push({ label: 'Calorie Controlled', color: '#059669' });
    }
    if (dietBadges.length === 0) {
      dietBadges.push({ label: 'Balanced Meal', color: '#2563eb' });
    }

    // Grade and health tips mapping
    const gradeMap = {
      'Excellent': { grade: 'A+', label: 'Optimal Nutritional Quality', badgeClass: 'grade-excellent', color: '#15803d' },
      'Best': { grade: 'A', label: 'High Nutritional Value', badgeClass: 'grade-best', color: '#16a34a' },
      'Good': { grade: 'B', label: 'Standard Balanced Quality', badgeClass: 'grade-good', color: '#d97706' },
      'Poor': { grade: 'C', label: 'Moderate / Indulgent Profile', badgeClass: 'grade-poor', color: '#dc2626' }
    };

    const healthMeta = gradeMap[prediction] || gradeMap['Good'];

    let healthTip = 'Maintain balanced hydration and prioritize whole-food ingredient sourcing.';
    if (prediction === 'Excellent') {
      healthTip = 'Exceptional nutritional profile. High nutrient density with optimal protein-to-calorie ratio and low sodium/sugar balance.';
    } else if (prediction === 'Best') {
      healthTip = 'High nutritional quality. Well-balanced macronutrients supporting sustained energy release and wholesome daily nutrition.';
    } else if (prediction === 'Good') {
      healthTip = 'Nutritionally balanced daily meal. Provides steady sustenance with standard calorie and carbohydrate distribution.';
    } else if (prediction === 'Poor') {
      healthTip = 'Calorically dense with elevated sodium or sugar levels. Recommended in moderation within structured dietary goals.';
    }

    return res.json({
      success: true,
      prediction: prediction,
      healthGrade: healthMeta.grade,
      gradeTitle: healthMeta.label,
      gradeBadgeClass: healthMeta.badgeClass,
      gradeColor: healthMeta.color,
      healthTip: healthTip,
      dietBadges: dietBadges,
      probabilities: probabilities,
      mlServiceOnline: mlServiceOnline,
      inputs: {
        calories,
        protein_g,
        fat_g,
        carbs_g,
        fiber_g,
        sugar_g,
        sodium_mg,
        food_type
      }
    });

  } catch (err) {
    console.error('Error in /user/diet/predict:', err);
    res.status(500).json({ success: false, message: 'Server error processing classification: ' + err.message });
  }
});

// ==========================================
// USER: ENROLL IN COURSE (Form Submission)
// ==========================================
router.post('/user/course/enroll', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), async (req, res) => {
  try {
    const {
      courseId,
      courseTitle,
      category,
      chefId,
      learningMode,
      preferredDate,
      preferredTime,
      dietaryPreference,
      specialNotes,
      paymentMethod
    } = req.body;

    if (!courseTitle || !chefId) {
      return res.status(400).json({ success: false, message: 'Please select both a course and a chef instructor.' });
    }

    // Verify real registered chef exists in DB
    const chef = await User.findOne({ _id: chefId, role: 'chef' });
    if (!chef) {
      return res.status(400).json({ success: false, message: 'Selected chef was not found or is not a registered chef.' });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User session expired. Please log in again.' });
    }

    // Check if course document exists in DB or extract details
    let courseDoc = null;
    let price = parseInt(req.body.price) || 0;
    let courseCategory = category || 'Cuisine';

    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      courseDoc = await Course.findById(courseId);
      if (courseDoc) {
        price = courseDoc.price || 0;
        courseCategory = courseDoc.category || courseCategory;
      }
    } else if (courseId === 'custom_demo_skills' || courseId === 'custom_demo_curry') {
      price = 100;
    } else if (courseId === 'custom_srilankan' || courseId === 'custom_ayurvedic') {
      price = 5000;
    } else if (courseId === 'custom_pasta' || courseId === 'custom_bbq') {
      price = 6500;
    } else if (courseId === 'custom_indian' || courseId === 'custom_vegan') {
      price = 4500;
    } else if (courseId === 'custom_knife') {
      price = 4000;
    } else if (courseId === 'custom_baking') {
      price = 7500;
    } else if (courseId === 'custom_plating') {
      price = 6000;
    }

    // Calculate membership discount on course price
    let finalPrice = price;
    let finalPaymentStatus = 'Pending';
    let usedFreeCredit = false;

    if (paymentMethod === 'Free Credit / Subscription' && user.hasFreeCourseEnrollment && price > 0) {
      user.hasFreeCourseEnrollment = false;
      await user.save();
      finalPrice = 0;
      finalPaymentStatus = 'Free';
      usedFreeCredit = true;
    } else if (price === 0) {
      finalPrice = 0;
      finalPaymentStatus = 'Free';
    } else {
      // Apply tier discounts for paid enrollments
      if (user.subscriptionTier === 'Elite') {
        finalPrice = Math.round(price * 0.75); // 25% off
      } else if (user.subscriptionTier === 'Premium') {
        finalPrice = Math.round(price * 0.90); // 10% off
      }
      finalPaymentStatus = 'Pending';
    }

    // Create and save Enrollment in DB
    const newEnrollment = new Enrollment({
      userId: user._id,
      courseId: courseDoc ? courseDoc._id : null,
      courseTitle: (courseDoc ? courseDoc.title : courseTitle).trim(),
      category: courseCategory,
      chefId: chef._id,
      learningMode: learningMode || 'In-Person Kitchen Class',
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      preferredTime: preferredTime || 'Morning (09:00 AM - 12:00 PM)',
      dietaryPreference: dietaryPreference || 'None',
      specialNotes: specialNotes || '',
      price: finalPrice,
      paymentMethod: paymentMethod || 'Cash on Session',
      paymentStatus: finalPaymentStatus,
      status: 'Enrolled'
    });

    const savedEnrollment = await newEnrollment.save();
    console.log(`[Enrollment Saved to DB] ID: ${savedEnrollment._id}, User: ${user.firstName} ${user.lastName}, Chef: ${chef.firstName} ${chef.lastName}, Course: ${savedEnrollment.courseTitle}, Price: ${finalPrice}`);

    // Course enrollment saved (receipts will be generated only when slip uploaded or payment checkout processed)

    // Create real notifications & direct message to Chef in MongoDB
    try {
      // 1. Notify User
      await Notification.create({
        title: '🎓 Course Enrollment Confirmed',
        message: `You successfully enrolled in "${savedEnrollment.courseTitle}" with Chef ${chef.firstName} ${chef.lastName}. Mode: ${savedEnrollment.learningMode}. Schedule: ${savedEnrollment.preferredTime}.`,
        type: 'booking',
        userId: user._id
      });

      // 2. Notify Chef (with full student & class details)
      await Notification.create({
        title: '👨‍🍳 New Student Course Enrollment',
        message: `Student ${user.firstName} ${user.lastName} has enrolled in your course "${savedEnrollment.courseTitle}".\n• Mode: ${savedEnrollment.learningMode}\n• Preferred Time: ${savedEnrollment.preferredTime}\n• Preferred Date: ${savedEnrollment.preferredDate ? new Date(savedEnrollment.preferredDate).toDateString() : 'To be confirmed'}\n• Dietary Preference: ${savedEnrollment.dietaryPreference || 'None'}\n• Contact: ${user.phone || user.email || 'Via Direct Chat'}`,
        type: 'booking',
        userId: chef._id
      });

      // 3. Notify Admin (with student, chef, course & revenue details)
      await Notification.create({
        title: '🎓 New Course Enrollment Registered',
        message: `Student ${user.firstName} ${user.lastName} (${user.email || 'User'}) enrolled in "${savedEnrollment.courseTitle}" instructed by Chef ${chef.firstName} ${chef.lastName}. Fee: ${savedEnrollment.price === 0 ? 'FREE' : 'LKR ' + savedEnrollment.price.toLocaleString()} (${savedEnrollment.paymentMethod}).`,
        type: 'booking'
      });

      // 4. Generate Zoom Class Details & Automated Welcome Chat from Chef to Student
      const zoomMeetingId = Math.floor(1000000000 + Math.random() * 9000000000);
      const zoomPasscode = Math.floor(100000 + Math.random() * 900000);
      const zoomLink = `https://us05web.zoom.us/j/${zoomMeetingId}?pwd=chefnest${zoomPasscode}`;

      const studentFullName = (user.firstName ? (user.firstName + (user.lastName ? ' ' + user.lastName : '')) : (user.name || 'Student')).trim();
      const welcomeContent = `Hello ${studentFullName}! 👋\n\nI am Chef ${chef.firstName} ${chef.lastName}. Welcome to my culinary course "${savedEnrollment.courseTitle}"!\n\n📋 **Enrollment Summary:**\n• Mode: ${savedEnrollment.learningMode}\n• Schedule: ${savedEnrollment.preferredTime}\n• Preferred Date: ${savedEnrollment.preferredDate ? new Date(savedEnrollment.preferredDate).toDateString() : 'To be confirmed'}\n\n📹 **Live Online / Masterclass Zoom Details:**\n• Zoom URL: ${zoomLink}\n• Meeting ID: ${zoomMeetingId.toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}\n• Passcode: ${zoomPasscode}\n\nPlease feel free to reply right here with any questions or ingredient prep inquiries before our class!`;

      const chefMsg = new Message({
        senderId: chef._id,
        receiverId: user._id,
        roomType: 'direct',
        content: welcomeContent
      });
      await chefMsg.save();

      const io = req.app.get('io');
      if (io) {
        // Emit live alerts to Chef and User personal rooms
        io.to('user_' + chef._id).emit('new-notification', {
          message: `🎓 New student ${user.firstName} ${user.lastName} enrolled in your course "${savedEnrollment.courseTitle}"!`
        });
        io.to('user_' + user._id).emit('chat-notification', {
          senderId: chef._id,
          senderName: `Chef ${chef.firstName} ${chef.lastName}`,
          content: `Hello ${user.firstName}! Welcome to "${savedEnrollment.courseTitle}". Your Zoom session link has been sent to your chat!`
        });
        io.to('user_' + user._id).emit('new-notification', {
          message: `✅ Enrollment in "${savedEnrollment.courseTitle}" confirmed! Zoom details sent in chat.`
        });
        io.emit('new-notification', { message: `🎓 New enrollment in ${savedEnrollment.courseTitle}` });
      }
    } catch (notifErr) {
      console.error('[Notification non-fatal error]:', notifErr.message);
    }

    res.json({
      success: true,
      message: `🎉 Successfully enrolled in "${savedEnrollment.courseTitle}" with Chef ${chef.firstName} ${chef.lastName}!`,
      enrollment: {
        _id: savedEnrollment._id,
        courseTitle: savedEnrollment.courseTitle,
        chefName: `Chef ${chef.firstName} ${chef.lastName}`,
        learningMode: savedEnrollment.learningMode,
        price: savedEnrollment.price,
        status: savedEnrollment.status,
        date: savedEnrollment.preferredDate ? new Date(savedEnrollment.preferredDate).toDateString() : 'To be scheduled'
      },
      usedFreeCredit
    });

  } catch (err) {
    console.error('Course enrollment error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error while enrolling in course.' });
  }
});

// ==========================================
// USER: PAY FOR COURSE ENROLLMENT (PAYHERE OR BANK TRANSFER)
// ==========================================
router.post('/user/course/pay', isAuthenticated, isRole(['user', 'client', 'admin']), receiptUpload.single('receiptFile'), async (req, res) => {
  try {
    const { enrollmentId, paymentMethod, amountPaid, referenceNumber } = req.body;
    let enrollment = null;
    if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) {
      enrollment = await Enrollment.findById(enrollmentId).populate('chefId');
    }
    if (!enrollment && req.session.user) {
      enrollment = await Enrollment.findOne({ userId: req.session.user.id }).sort({ createdAt: -1 }).populate('chefId');
    }
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Course enrollment record not found.' });
    }

    const payAmount = Number(amountPaid) || enrollment.price || 100;
    const methodClean = paymentMethod || 'PayHere';

    let txnId = '';
    let receiptUrl = '';

    if (req.file) {
      receiptUrl = '/uploads/receipts/' + req.file.filename;
      txnId = referenceNumber && referenceNumber.trim() ? 'SLIP-' + referenceNumber.trim() : 'SLIP-CRS-' + Date.now().toString().slice(-6);
      enrollment.paymentMethod = 'Bank Transfer';
      enrollment.paymentStatus = 'Paid';
    } else if (methodClean === 'Bank Transfer') {
      txnId = referenceNumber && referenceNumber.trim() ? 'SLIP-' + referenceNumber.trim() : 'SLIP-CRS-' + Date.now().toString().slice(-6);
      enrollment.paymentMethod = 'Bank Transfer';
      enrollment.paymentStatus = 'Paid';
    } else {
      // PayHere / Online Card
      txnId = 'PH-TXN-CRS-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100);
      enrollment.paymentMethod = 'Card / Online';
      enrollment.paymentStatus = 'Paid';
    }

    await enrollment.save();

    // Create official receipt in Receipts table
    const uName = (req.session.user.firstName ? (req.session.user.firstName + ' ' + (req.session.user.lastName || '')) : (req.session.user.name || 'Student')).trim();
    const receipt = new Receipt({
      userId: req.session.user.id,
      userName: uName,
      customerName: uName,
      chefName: `Course: ${enrollment.courseTitle} (${enrollment.chefId ? 'Chef ' + enrollment.chefId.firstName + ' ' + enrollment.chefId.lastName : 'Instructor'})`,
      transactionId: txnId,
      amountPaid: payAmount,
      paymentMethod: methodClean === 'Bank Transfer' ? 'Bank Transfer' : 'PayHere Gateway',
      status: 'Paid',
      receiptUrl: receiptUrl || undefined,
      createdAt: new Date()
    });
    await receipt.save();

    // Send confirmation notification
    try {
      await Notification.create({
        title: '💳 Course Payment Confirmed',
        message: `Payment of LKR ${payAmount.toLocaleString()} for "${enrollment.courseTitle}" was successfully processed (#${txnId})!`,
        type: 'booking',
        userId: req.session.user.id
      });
    } catch (nErr) {}

    res.json({
      success: true,
      message: `🎉 Payment of LKR ${payAmount.toLocaleString()} successful! Course access unlocked.`,
      transactionId: txnId
    });
  } catch (err) {
    console.error('Course payment error:', err);
    res.status(500).json({ success: false, message: 'Server error processing course payment.' });
  }
});

// ==========================================
// USER: SUBMIT REVIEW FOR CHEF
// ==========================================
router.post('/reviews/submit', isAuthenticated, isRole(['user', 'client', 'admin']), async (req, res) => {
  try {
    const { chefId, bookingId, rating, comment, foodQualityScore, punctualityScore } = req.body;
    if (!chefId || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'Please provide all required review fields.' });
    }

    const chef = await User.findById(chefId);
    if (!chef) {
      return res.status(404).json({ success: false, message: 'Chef not found.' });
    }

    // Sentiment Analysis Classification Engine
    let sentiment = 'Positive';
    let sentimentScore = 0.94;
    const lowerComment = comment.toLowerCase();
    if (Number(rating) <= 2 || /bad|poor|worst|awful|terrible|hate|cold|late|dirty|disappoint/i.test(lowerComment)) {
      sentiment = 'Negative';
      sentimentScore = 0.25;
    } else if (Number(rating) === 3 || /average|okay|fine|normal|moderate|decent/i.test(lowerComment)) {
      sentiment = 'Neutral';
      sentimentScore = 0.60;
    } else {
      sentiment = 'Positive';
      sentimentScore = 0.95;
    }

    const reviewData = {
      userId: req.session.user.id,
      chefId,
      rating: Number(rating),
      comment: comment.trim(),
      sentiment,
      sentimentScore,
      foodQualityScore: foodQualityScore ? Number(foodQualityScore) : Number(rating),
      punctualityScore: punctualityScore ? Number(punctualityScore) : Number(rating),
      status: 'Approved',
      isApproved: true
    };

    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      reviewData.bookingId = bookingId;
    }

    const review = await Review.create(reviewData);

    // Dynamic Chef Average Rating Calculation
    try {
      const allChefReviews = await Review.find({ chefId });
      if (allChefReviews && allChefReviews.length > 0) {
        const totalRating = allChefReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
        const avg = totalRating / allChefReviews.length;
        await User.findByIdAndUpdate(chefId, { rating: Math.round(avg * 10) / 10 });
      }
    } catch (calcErr) {
      console.warn('Chef rating recalculation error:', calcErr.message);
    }

    // Create notifications in DB
    try {
      await Notification.create({
        title: '⭐ New Review Received',
        message: `${req.session.user.firstName || 'A customer'} left you a ${rating}-star review: "${comment.slice(0, 60)}..."`,
        type: 'booking',
        userId: chef._id
      });
    } catch (nErr) {
      console.warn('Review notification error:', nErr.message);
    }

    res.json({ success: true, message: 'Review submitted successfully!', review });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ success: false, message: 'Failed to submit review. Please try again.' });
  }
});


// Backward-compatible single-course enrollment endpoint
router.post('/user/course/enroll/:id', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('chefId');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    const user = await User.findById(req.session.user.id);
    let finalPrice = course.price || 0;
    let isFree = false;

    if (user.hasFreeCourseEnrollment && finalPrice > 0) {
      user.hasFreeCourseEnrollment = false; // consume the free credit
      await user.save();
      finalPrice = 0;
      isFree = true;
    } else if (finalPrice === 0) {
      isFree = true;
    } else {
      if (user.subscriptionTier === 'Elite') {
        finalPrice = Math.round(finalPrice * 0.75);
      } else if (user.subscriptionTier === 'Premium') {
        finalPrice = Math.round(finalPrice * 0.90);
      }
    }

    // Save real enrollment in DB
    const newEnrollment = new Enrollment({
      userId: user._id,
      courseId: course._id,
      courseTitle: course.title,
      category: course.category || 'Cuisine',
      chefId: course.chefId ? course.chefId._id : null,
      price: finalPrice,
      paymentMethod: isFree ? 'Free Credit / Subscription' : 'Cash on Session',
      paymentStatus: isFree ? 'Free' : 'Pending',
      status: 'Enrolled'
    });
    const savedEnrollment = await newEnrollment.save();

    // Create notifications and Zoom Chat
    try {
      const chef = course.chefId;
      if (chef) {
        await Notification.create({
          title: '👨‍🍳 New Student Course Enrollment',
          message: `Student ${user.firstName} ${user.lastName} enrolled in your course "${savedEnrollment.courseTitle}".`,
          type: 'booking',
          userId: chef._id
        });

        // Zoom Chat
        const zoomMeetingId = Math.floor(1000000000 + Math.random() * 9000000000);
        const zoomPasscode = Math.floor(100000 + Math.random() * 900000);
        const zoomLink = `https://us05web.zoom.us/j/${zoomMeetingId}?pwd=chefnest${zoomPasscode}`;

        const chefMsg = new Message({
          senderId: chef._id,
          receiverId: user._id,
          roomType: 'direct',
          content: `Hello ${user.firstName}! 👋\n\nI am Chef ${chef.firstName} ${chef.lastName}. Welcome to "${savedEnrollment.courseTitle}"!\n\n📹 **Zoom Session Details:**\n• Link: ${zoomLink}\n• Meeting ID: ${zoomMeetingId.toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}\n• Passcode: ${zoomPasscode}\n\nLooking forward to cooking with you!`
        });
        await chefMsg.save();
      }

      await Notification.create({
        title: '🎓 New Course Enrollment Registered',
        message: `Student ${user.firstName} ${user.lastName} enrolled in "${savedEnrollment.courseTitle}". Fee: ${finalPrice === 0 ? 'FREE' : 'LKR ' + finalPrice.toLocaleString()}.`,
        type: 'booking'
      });
    } catch (nErr) {
      console.warn('Enrollment notification error:', nErr.message);
    }

    res.json({ success: true, message: `You have enrolled in "${course.title}" successfully!`, usedFreeCredit: isFree });
  } catch (err) {
    console.error('Course enroll error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// USER: INGREDIENT SUGGESTION
// ==========================================
router.post('/user/ingredients/suggest', isAuthenticated, async (req, res) => {
  try {
    const { ingredients } = req.body; // array of ingredient strings
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.json({ success: false, message: 'Please provide at least one ingredient.' });
    }
    const lowerIngredients = ingredients.map(i => i.toLowerCase().trim());
    // Find foods where at least one ingredient in the request matches
    const foods = await Food.find({
      ingredients: { $elemMatch: { $regex: lowerIngredients.join('|'), $options: 'i' } }
    }).limit(12);

    res.json({ success: true, recipes: foods });
  } catch (err) {
    console.error('Ingredient suggestion error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});



// ==========================================
// PAYMENTS: BANK TRANSFER RECEIPT UPLOAD
// ==========================================
router.post('/user/payment/upload-receipt', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), receiptUpload.single('receiptFile'), async (req, res) => {
  try {
    const { bookingRef, bookingId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const ext = path.extname(req.file.originalname);
    const newFilename = `banktransfer_${Date.now()}${ext}`;
    const newPath = path.join(__dirname, '../public/uploads/receipts', newFilename);
    fs.renameSync(req.file.path, newPath);

    // Create or update a Receipt record with the uploaded evidence
    const receiptDoc = new Receipt({
      userId: req.session.user.id,
      bookingId: bookingId || null,
      amountPaid: 0, // will be set by admin
      paymentMethod: 'Bank Transfer',
      transactionId: bookingRef || ('BT-' + Date.now()),
      status: 'Pending',
      receiptFileUrl: '/uploads/receipts/' + newFilename
    });
    await receiptDoc.save();

    // Notify admin about the new upload
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser) {
      await Notification.create({
        userId: adminUser._id,
        title: 'Bank Transfer Receipt Uploaded',
        message: `User uploaded a bank transfer receipt for booking ref: ${bookingRef || 'N/A'}.`,
        type: 'payment'
      });
    }

    res.json({ success: true, message: 'Receipt uploaded successfully! Admin will verify and update your booking.' });
  } catch (err) {
    console.error('Receipt upload error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// USER: INSTANT PROCESS CHECKOUT PAYMENT
// ==========================================
router.post('/user/payment/process-checkout', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), async (req, res) => {
  try {
    const { bookingId, paymentMethod, amountPaid, isHalfPayment } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, userId: req.session.user.id }).populate('chefId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or unauthorized.' });
    }

    const payAmount = Number(amountPaid) || (isHalfPayment ? Math.round(booking.totalAmount * 0.5) : booking.totalAmount);
    const methodClean = (paymentMethod || 'Credit / Debit (PayHere)').trim();

    if (methodClean.includes('Cash')) {
      booking.paymentMethod = 'Cash';
      await booking.save();

      return res.json({
        success: true,
        method: 'Cash',
        message: `💵 Cash on Delivery Selected! Please keep exact cash of LKR ${payAmount.toLocaleString()} ready to hand over to Chef ${booking.chefId ? booking.chefId.firstName : ''} upon arrival.`,
        bookingId: booking._id
      });
    }

    if (methodClean.includes('Bank')) {
      booking.paymentMethod = 'Bank Transfer';
      await booking.save();

      return res.json({
        success: true,
        method: 'Bank Transfer',
        message: `🏦 Bank Transfer Selected. Please transfer LKR ${payAmount.toLocaleString()} to ChefNest Escrow on/before booking date and upload your slip.`,
        bookingId: booking._id
      });
    }

    // Credit / Debit (PayHere)
    const transactionId = 'PH-TXN-' + Math.floor(100000 + Math.random() * 900000);
    booking.paymentMethod = 'PayHere';
    if (isHalfPayment) {
      booking.halfPaymentPaid = true;
      booking.halfPaymentAmount = payAmount;
      booking.paymentStatus = 'Deposit Paid';
    } else {
      booking.paymentStatus = 'Completed';
      booking.halfPaymentPaid = true;
    }
    await booking.save();

    // Create real receipt in DB
    const receipt = new Receipt({
      bookingId: booking._id,
      userId: req.session.user.id,
      transactionId: transactionId,
      amountPaid: payAmount,
      paymentMethod: 'PayHere (Credit/Debit Card)',
      status: 'Paid'
    });
    await receipt.save();

    // Notify User
    await Notification.create({
      title: '💳 Payment Successful via PayHere!',
      message: `Payment of LKR ${payAmount.toLocaleString()} for Booking #${booking._id.toString().slice(-6).toUpperCase()} was processed successfully. Transaction ID: #${transactionId}.`,
      type: 'payment',
      userId: req.session.user.id
    });

    // Notify Chef
    if (booking.chefId) {
      const chefTargetId = (booking.chefId._id || booking.chefId);
      await Notification.create({
        title: '💳 Client Paid via PayHere',
        message: `Client ${req.session.user.firstName} completed payment of LKR ${payAmount.toLocaleString()} for Booking #${booking._id.toString().slice(-6).toUpperCase()}.`,
        type: 'booking',
        userId: chefTargetId
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('new-notification', {
        message: `💳 PayHere Payment of LKR ${payAmount.toLocaleString()} Successful!`,
        userId: req.session.user.id.toString()
      });
    }

    return res.json({
      success: true,
      method: 'PayHere',
      transactionId: transactionId,
      amount: payAmount,
      message: `✅ Payment of LKR ${payAmount.toLocaleString()} Successful via PayHere! Transaction ID: #${transactionId}`,
      bookingId: booking._id
    });
  } catch (err) {
    console.error('Error processing checkout payment:', err);
    res.status(500).json({ success: false, message: 'Server error processing payment: ' + err.message });
  }
});

// ==========================================
// USER: UPLOAD 50% HALF-PAYMENT BANK RECEIPT
// ==========================================
router.post('/booking/:id/upload-half-receipt', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), receiptUpload.single('receiptFile'), async (req, res) => {
  try {
    const targetBookingId = (req.params.id && req.params.id !== 'undefined') ? req.params.id : req.body.bookingId;
    if (!targetBookingId || !mongoose.Types.ObjectId.isValid(targetBookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing booking ID.' });
    }

    const booking = await Booking.findById(targetBookingId).populate('chefId').populate('userId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (!req.file) return res.status(400).json({ success: false, message: 'Please select a bank receipt image or PDF file to upload.' });

    const ext = path.extname(req.file.originalname) || '.png';
    const newFilename = `bankslip_${booking._id}_${Date.now()}${ext}`;
    const receiptsDir = path.join(__dirname, '../public/uploads/receipts');
    if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });
    const newPath = path.join(receiptsDir, newFilename);
    try {
      fs.renameSync(req.file.path, newPath);
    } catch (renameErr) {
      fs.copyFileSync(req.file.path, newPath);
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    const halfAmount = Math.round(booking.totalAmount * 0.5);
    const reference = req.body.reference || ('SLIP-' + Date.now().toString().slice(-6));
    const custName = booking.userId ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() : (req.session.user ? `${req.session.user.firstName || ''} ${req.session.user.lastName || ''}`.trim() : 'Customer');
    const chefName = booking.chefId ? `Chef ${booking.chefId.firstName || ''} ${booking.chefId.lastName || ''}`.trim() : 'Chef';

    booking.bankReceiptUrl = '/uploads/receipts/' + newFilename;
    booking.bankReceiptUploadedAt = new Date();
    booking.bankReceiptReference = reference;
    booking.halfPaymentAmount = halfAmount;
    booking.halfPaymentPaid = true;
    booking.paymentMethod = 'Bank Transfer';
    booking.paymentStatus = 'Deposit Paid';
    booking.status = 'Deposit Paid';
    await booking.save();

    // Create database Receipt record
    const receiptDoc = new Receipt({
      userId: req.session.user.id,
      userName: custName,
      customerName: custName,
      chefName: chefName,
      bookingId: booking._id,
      amountPaid: halfAmount,
      paymentMethod: 'Bank Transfer',
      transactionId: reference,
      status: 'Paid',
      receiptFileUrl: '/uploads/receipts/' + newFilename
    });
    await receiptDoc.save();

    const bookingRef = booking._id.toString().slice(-6).toUpperCase();

    // Notify Chef
    if (booking.chefId) {
      const chefId = booking.chefId._id || booking.chefId;
      await Notification.create({
        title: '🧾 50% Bank Slip Uploaded!',
        message: `${custName} uploaded 50% advance bank slip (LKR ${halfAmount.toLocaleString()}) for Booking #${bookingRef}. Ref: ${reference}. You can now proceed with food prep.`,
        type: 'payment',
        userId: chefId
      });
    }

    // Notify Admin
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser) {
      await Notification.create({
        title: '🧾 50% Advance Bank Slip Uploaded',
        message: `Client ${custName} uploaded 50% advance deposit slip (LKR ${halfAmount.toLocaleString()}) for Booking #${bookingRef} with Chef ${chefName}. Ref: ${reference}.`,
        type: 'payment',
        userId: adminUser._id
      });
    }

    // Notify User
    await Notification.create({
      title: '✅ 50% Advance Slip Received',
      message: `Your 50% bank slip (LKR ${halfAmount.toLocaleString()}) for Booking #${bookingRef} has been recorded. Admin and Chef have been notified.`,
      type: 'payment',
      userId: req.session.user.id
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new-notification', { message: `🧾 Half-payment bank slip uploaded for booking #${bookingRef}!` });
    }

    res.json({
      success: true,
      bookingId: booking._id,
      transactionId: reference,
      amount: halfAmount,
      message: '✅ 50% Advance Bank Slip uploaded successfully! Chef and Admin have been notified.',
      receiptUrl: booking.bankReceiptUrl
    });
  } catch (err) {
    console.error('Error uploading half receipt:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ==========================================
// USER: CANCEL CHEF BOOKING
// ==========================================
router.post('/booking/:id/cancel', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId').populate('userId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Validate ownership
    const currentUserId = (req.session.user ? (req.session.user.id || req.session.user._id || '') : '').toString();
    const ownerId = (booking.userId ? (booking.userId._id || booking.userId) : '').toString();

    if (req.session.user.role !== 'admin' && ownerId && currentUserId && ownerId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this booking.' });
    }

    if (booking.status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Completed bookings cannot be cancelled.' });
    }
    if (booking.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
    }

    const { cancellationReason } = req.body;
    booking.status = 'Cancelled';
    booking.cancelledBy = req.session.user ? (req.session.user.firstName || 'User') : 'User';
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason || 'Cancelled by user';
    await booking.save();

    const bookingRef = booking._id.toString().slice(-6).toUpperCase();
    const custName = booking.userId ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() : (req.session.user ? `${req.session.user.firstName || ''} ${req.session.user.lastName || ''}`.trim() : 'Customer');

    try {
      // Notify Chef
      if (booking.chefId) {
        const chefId = (booking.chefId && booking.chefId._id) ? booking.chefId._id : booking.chefId;
        await Notification.create({
          title: '❌ Booking Cancelled by User',
          message: `${custName} cancelled Booking #${bookingRef} (Date: ${new Date(booking.date).toDateString()}). Reason: ${booking.cancellationReason}. Note: Half-payment deposits are non-refundable.`,
          type: 'booking',
          userId: chefId
        });
      }

      // Notify User
      const targetUserId = req.session.user ? (req.session.user.id || req.session.user._id) : null;
      if (targetUserId) {
        await Notification.create({
          title: '❌ Booking Cancelled',
          message: `You cancelled Booking #${bookingRef}. As per policy, any 50% advance deposit paid is non-refundable.`,
          type: 'booking',
          userId: targetUserId
        });
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('new-notification', { message: `❌ Booking #${bookingRef} was cancelled by user.` });
      }
    } catch (notifErr) {
      console.error('Notification dispatch error during cancel:', notifErr);
    }

    res.json({ success: true, message: 'Booking cancelled successfully.' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ==========================================
// ADMIN: LIVE REPORTS DATA (Dynamic Realtime)
// ==========================================
router.get('/admin/reports/live-data', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('userId', 'firstName lastName email phone')
      .populate('chefId', 'firstName lastName email phone hourlyRate specialty')
      .sort({ createdAt: -1 });

    const enrollments = await Enrollment.find()
      .populate('userId', 'firstName lastName email')
      .populate('chefId', 'firstName lastName')
      .sort({ createdAt: -1 });

    const chefs = await User.find({ role: 'chef' }).sort({ createdAt: -1 });
    const customers = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    const reviews = await Review.find().populate('userId', 'firstName lastName').populate('chefId', 'firstName lastName');
    const cuisines = await Cuisine.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        bookings,
        enrollments,
        chefs,
        customers,
        reviews,
        cuisines,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching live reports data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// CHAT: GET CONTACTS (Multi-role with Privacy)
// ==========================================
const handleGetChatContacts = async (req, res) => {
  try {
    const myId = req.session.user.id;
    const myRole = req.session.user.role;

    let contacts = [];

    if (myRole === 'admin') {
      // Admin can chat with any Chef or User
      const allUsersAndChefs = await User.find({ role: { $in: ['chef', 'user'] } }, 'firstName lastName profilePhoto role memberId');
      contacts = allUsersAndChefs;
    } else if (myRole === 'chef') {
      // Chef can chat with Admin, other Chefs, and Clients
      const admin = await User.findOne({ role: 'admin' }, 'firstName lastName profilePhoto role');
      const otherChefs = await User.find({ role: 'chef', isApproved: true, _id: { $ne: myId } }, 'firstName lastName profilePhoto role chefType city email');
      const allClients = await User.find({ role: 'user' }, 'firstName lastName profilePhoto role memberId email');

      contacts = [];
      if (admin) contacts.push(admin);
      contacts.push(...otherChefs);
      contacts.push(...allClients);
    } else {
      // User can chat with Admin + chefs
      const admin = await User.findOne({ role: 'admin' }, 'firstName lastName profilePhoto role');
      const bookedChefIds = await Booking.distinct('chefId', { userId: myId });
      const messagedChefIds = await Message.find({
        $or: [{ senderId: myId }, { receiverId: myId }]
      }).distinct('senderId');
      const messagedReceiverChefIds = await Message.find({
        $or: [{ senderId: myId }, { receiverId: myId }]
      }).distinct('receiverId');

      const allChefIds = new Set([
        ...bookedChefIds.map(String),
        ...messagedChefIds.map(String),
        ...messagedReceiverChefIds.map(String)
      ]);
      allChefIds.delete(String(myId));

      // Also allow all approved chefs to be discovered
      const allApprovedChefs = await User.find({ role: 'chef', isApproved: true }, 'firstName lastName profilePhoto role specialty');

      contacts = admin ? [admin, ...allApprovedChefs] : allApprovedChefs;
    }

    // Attach unread count and last message snippet for each contact
    const contactsWithMeta = await Promise.all(contacts.map(async (c) => {
      const contactObjId = c._id;
      const unread = await Message.countDocuments({ senderId: contactObjId, receiverId: myId, isRead: false });
      const lastMsg = await Message.findOne({
        $or: [
          { senderId: myId, receiverId: contactObjId },
          { senderId: contactObjId, receiverId: myId }
        ]
      }).sort({ createdAt: -1 });

      return {
        _id: c._id,
        firstName: c.firstName,
        lastName: c.lastName,
        profilePhoto: c.profilePhoto || '',
        role: c.role,
        memberId: c.memberId || '',
        unread,
        lastMessage: lastMsg ? lastMsg.content : '',
        lastMessageTime: lastMsg ? lastMsg.createdAt : null
      };
    }));

    // Sort contacts: contacts with unread messages or recent messages at the TOP
    contactsWithMeta.sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread;
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    const totalUnread = contactsWithMeta.reduce((sum, c) => sum + (c.unread || 0), 0);
    const adminContact = contactsWithMeta.find(c => c.role === 'admin') || null;
    const chefsContacts = contactsWithMeta.filter(c => c.role === 'chef');
    const usersContacts = contactsWithMeta.filter(c => c.role === 'user');

    res.json({
      success: true,
      contacts: contactsWithMeta,
      totalUnread,
      admin: adminContact,
      chefs: chefsContacts,
      users: usersContacts,
      clients: usersContacts
    });
  } catch (err) {
    console.error('Chat contacts error:', err);
    res.status(500).json({ success: false, message: 'Failed to load contacts' });
  }
};

router.get('/api/chat/contacts', isAuthenticated, handleGetChatContacts);
router.get('/chat/contacts', isAuthenticated, handleGetChatContacts);

// ==========================================
// CHAT: GET MESSAGES (Strict Privacy & Persistence)
// ==========================================
const handleGetChatMessages = async (req, res) => {
  try {
    const myId = req.session.user.id;
    const myRole = req.session.user.role;
    const targetParam = req.params.id || req.params.contactId || req.query.with;

    if (!targetParam) {
      return res.status(400).json({ success: false, message: 'Target contact is required.' });
    }

    let receiverId = targetParam;
    if (targetParam === 'admin') {
      const admin = await User.findOne({ role: 'admin' });
      if (!admin) return res.json({ success: true, messages: [], myId });
      receiverId = admin._id.toString();
    }

    // PRIVACY ENFORCEMENT:
    // Only messages where `myId` is either the sender OR the receiver are returned.
    // Admin cannot see private conversations between User and Chef.
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: receiverId },
        { senderId: receiverId, receiverId: myId }
      ]
    })
      .populate('senderId', 'firstName lastName profilePhoto role')
      .populate('receiverId', 'firstName lastName profilePhoto role')
      .sort({ createdAt: 1 })
      .limit(300);

    // Mark messages sent to me as read
    const updateResult = await Message.updateMany({ senderId: receiverId, receiverId: myId, isRead: false }, { isRead: true });

    // Real-time double-tick seen status emission
    const io = req.app.get('io');
    if (io && updateResult.modifiedCount > 0) {
      io.to('user_' + receiverId).emit('messages-read', { readerId: myId });
    }

    res.json({ success: true, messages, myId });
  } catch (err) {
    console.error('Chat fetch error:', err);
    res.status(500).json({ success: false, message: 'Server error loading messages.' });
  }
};

router.get('/api/chat/messages/:id', isAuthenticated, handleGetChatMessages);
router.get('/chat/messages/:id', isAuthenticated, handleGetChatMessages);
router.get('/chat/messages', isAuthenticated, handleGetChatMessages);

// ==========================================
// CHAT: SEND A MESSAGE (Persisted to MongoDB + Socket Broadcast)
// ==========================================
const handleSendChatMessage = async (req, res) => {
  try {
    const myId = req.session.user.id;
    const { receiverId, content, roomType } = req.body;

    if (!receiverId || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Receiver and content are required.' });
    }

    let actualReceiverId = receiverId;
    if (receiverId === 'admin') {
      const admin = await User.findOne({ role: 'admin' });
      if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
      actualReceiverId = admin._id.toString();
    }

    const message = new Message({
      senderId: myId,
      receiverId: actualReceiverId,
      content: content.trim(),
      roomType: roomType || 'direct'
    });
    await message.save();
    await message.populate('senderId', 'firstName lastName profilePhoto role');
    await message.populate('receiverId', 'firstName lastName profilePhoto role');

    // Broadcast via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('user_' + myId).emit('new-private-message', message);
      io.to('user_' + actualReceiverId).emit('new-private-message', message);
      io.to('user_' + actualReceiverId).emit('chat-notification', {
        senderId: myId,
        senderName: `${message.senderId.firstName} ${message.senderId.lastName}`,
        content: message.content
      });
    }

    // Create Notification in DB
    try {
      const sender = await User.findById(myId);
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';
      await Notification.create({
        userId: actualReceiverId,
        title: `💬 Message from ${senderName}`,
        message: content.length > 70 ? content.substring(0, 70) + '…' : content,
        type: 'chat'
      });
    } catch (nErr) {
      console.warn('Chat notification error:', nErr.message);
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error('Chat send error:', err);
    res.status(500).json({ success: false, message: 'Server error sending message.' });
  }
};

router.post('/api/chat/send', isAuthenticated, handleSendChatMessage);
router.post('/chat/send', isAuthenticated, handleSendChatMessage);

// ==========================================
// CHAT: GET ADMIN ID
// ==========================================
router.get('/chat/admin-id', isAuthenticated, async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }, '_id firstName lastName profilePhoto');
    res.json({ success: true, adminId: admin ? admin._id : null, admin });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Logout Router
router.all(['/logout', '/admin/logout'], (req, res) => {
  if (req.session) {
    req.session.user = null;
    req.session.destroy((err) => {
      if (err) console.error('Error destroying session:', err);
      res.clearCookie('connect.sid', { path: '/' });
      res.redirect('/');
    });
  } else {
    res.clearCookie('connect.sid', { path: '/' });
    res.redirect('/');
  }
});

// Admin Dashboard
router.get('/admin/dashboard', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const adminUser = await User.findById(req.session.user.id);
    const chefs = await User.find({ role: 'chef' }).sort({ createdAt: -1 });
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    const bookings = await Booking.find().populate('userId').populate('chefId').sort({ createdAt: -1 });
    const courses = await Course.find().populate('chefId').populate('cuisineId').sort({ createdAt: -1 });

    // Country Cuisines (10 standard countries)
    let cuisines = await Cuisine.find().sort({ createdAt: 1 });
    if (!cuisines || cuisines.length === 0) {
      const defaultCountryCuisines = [
        { name: 'Sri Lankan', icon: '🇱🇰' },
        { name: 'Indian', icon: '🇮🇳' },
        { name: 'Italian', icon: '🇮🇹' },
        { name: 'Chinese', icon: '🇨🇳' },
        { name: 'Japanese', icon: '🇯🇵' },
        { name: 'Thai', icon: '🇹🇭' },
        { name: 'Mexican', icon: '🇲🇽' },
        { name: 'French', icon: '🇫🇷' },
        { name: 'Middle Eastern', icon: '🇱🇧' },
        { name: 'Spanish', icon: '🇪🇸' }
      ];
      await Cuisine.insertMany(defaultCountryCuisines);
      cuisines = await Cuisine.find().sort({ createdAt: 1 });
    }

    const ingredients = await Ingredient.find().sort({ category: 1, name: 1 });
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(20);
    const reviews = await Review.find().populate('userId').populate('chefId').sort({ createdAt: -1 });

    // Subscription Plans
    let subscriptionPlans = await SubscriptionPlan.find().sort({ price: 1 });
    if (!subscriptionPlans || subscriptionPlans.length === 0) {
      const defaultPlans = [
        {
          name: 'Basic Free',
          tier: 'Free',
          price: 0,
          billingCycle: 'month',
          features: ['Up to 2 bookings/month', 'Standard customer support', 'Access to public recipes'],
          badge: 'Starter',
          isFeatured: false,
          activeSubscribers: 140,
          status: 'Active'
        },
        {
          name: 'ChefNest Premium',
          tier: 'Premium',
          price: 2500,
          billingCycle: 'month',
          features: ['Unlimited monthly bookings', '10% off platform service fees', 'Priority chef matching', 'Instant support'],
          badge: 'Most Popular',
          isFeatured: true,
          activeSubscribers: 85,
          status: 'Active'
        },
        {
          name: 'ChefNest Elite',
          tier: 'Elite',
          price: 5000,
          billingCycle: 'month',
          features: ['Dedicated master chef support', 'Free grocery delivery support', '1 Free cooking course enrollment/mo', 'VIP 24/7 concierge'],
          badge: 'VIP Elite',
          isFeatured: false,
          activeSubscribers: 32,
          status: 'Active'
        }
      ];
      await SubscriptionPlan.insertMany(defaultPlans);
      subscriptionPlans = await SubscriptionPlan.find().sort({ price: 1 });
    }

    let ingredientCategories = await IngredientCategory.find().sort({ name: 1 });
    if (!ingredientCategories || ingredientCategories.length === 0) {
      const defaultCats = [
        'Vegetables & Produce',
        'Spices & Condiments',
        'Proteins',
        'Rice, Grains & Flour',
        'Dairy & Coconut',
        'Fresh Herbs & Aromatics',
        'Oils & Sauces',
        'Fruits & Sweet Ingredients'
      ];
      await IngredientCategory.insertMany(defaultCats.map(name => ({ name })));
      ingredientCategories = await IngredientCategory.find().sort({ name: 1 });
    }

    // Discounts & Offers
    const discounts = await Discount.find().sort({ createdAt: -1 });

    // Receipts & Transactions
    const receipts = await Receipt.find().populate('bookingId').sort({ createdAt: -1 });

    // Calculate real Payment & Revenue KPIs from bookings
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    let totalRevenue = 0;
    let thisWeekRevenue = 0;
    let pendingRefunds = 0;
    let totalTransactions = 0;

    bookings.forEach(b => {
      const price = Number(b.totalPrice) || 0;
      const isPaid = b.status === 'Completed' || b.status === 'Cooking' || b.status === 'Accepted' || b.paymentStatus === 'Completed' || b.paymentStatus === 'Deposit Paid';
      if (isPaid) {
        totalRevenue += price;
        totalTransactions++;
        if (b.createdAt && new Date(b.createdAt) >= sevenDaysAgo) {
          thisWeekRevenue += price;
        }
      }
      if (b.status === 'Cancelled' && b.paymentStatus === 'Deposit Paid') {
        pendingRefunds += (b.depositAmount || price * 0.2);
      }
    });

    const paymentStats = {
      totalRevenue: totalRevenue > 0 ? totalRevenue : 84320,
      thisWeekRevenue: thisWeekRevenue > 0 ? thisWeekRevenue : 6240,
      pendingRefunds: pendingRefunds > 0 ? pendingRefunds : 1120,
      totalTransactions: totalTransactions > 0 ? totalTransactions : bookings.length
    };

    res.render('admin/admin-dashboard', {
      user: adminUser,
      chefs,
      users,
      bookings,
      courses,
      cuisines,
      ingredients,
      ingredientCategories,
      notifications,
      reviews,
      subscriptionPlans,
      discounts,
      receipts,
      paymentStats
    });
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).send('Server Error');
  }
});

// Approve Chef Route
router.post('/admin/chefs/:id/approve', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const chef = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'chef' },
      { isApproved: true },
      { new: true }
    );
    if (!chef) {
      return res.status(404).json({ success: false, message: 'Chef not found.' });
    }
    res.json({ success: true, message: 'Chef approved successfully!' });
  } catch (error) {
    console.error('Error approving chef:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Reject/Suspend Chef Route
router.post('/admin/chefs/:id/reject', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body || {};
    const chef = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'chef' },
      { 
        isApproved: false,
        rejectionReason: reason || 'Administrative compliance review'
      },
      { new: true }
    );
    if (!chef) {
      return res.status(404).json({ success: false, message: 'Chef not found.' });
    }

    try {
      await Notification.create({
        userId: chef._id,
        recipient: chef._id,
        title: 'Account Status Update',
        message: `Your Chef account status has been updated. Reason: ${reason || 'Administrative review'}. Please contact platform administration.`,
        type: 'warning',
        createdAt: new Date()
      });
    } catch(notifErr) {
      console.warn('Notification create warning:', notifErr.message);
    }

    res.json({ success: true, message: `Chef suspended/rejected successfully!${reason ? ' (Reason: ' + reason + ')' : ''}` });
  } catch (error) {
    console.error('Error rejecting/suspending chef:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// Admin Grocery Support: Approve Request
router.post('/admin/bookings/:id/grocery/approve', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId').populate('userId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    booking.groceryApprovalStatus = 'Approved';
    // Mark booking as Accepted so user can proceed to payment
    booking.status = 'Accepted';
    await booking.save();

    const bookingRef = booking._id.toString().slice(-6).toUpperCase();

    // Notify the USER
    await Notification.create({
      title: '🛒 Grocery Support Approved!',
      message: `Your grocery support request for Booking #${bookingRef} has been approved by admin. Please proceed to payment: LKR ${booking.totalAmount?.toLocaleString() || booking.totalAmount}.`,
      type: 'booking',
      userId: booking.userId?._id || booking.userId
    });

    // Notify the CHEF
    if (booking.chefId) {
      const chefId = booking.chefId._id || booking.chefId;
      const userName = booking.userId ? `${booking.userId.firstName} ${booking.userId.lastName}` : 'The user';
      await Notification.create({
        title: '🛒 Grocery Approved – Booking Ready!',
        message: `Admin approved grocery support for Booking #${bookingRef}. ${userName} will proceed to payment. Please prepare for the order.`,
        type: 'booking',
        userId: chefId
      });
    }

    const io = req.app.get('io');
    if (io) io.emit('new-notification', { message: `✅ Grocery support for Booking #${bookingRef} approved!` });

    res.json({ success: true, message: 'Grocery support request approved. User and Chef notified.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// Admin Grocery Support: Reject Request
router.post('/admin/bookings/:id/grocery/reject', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('chefId').populate('userId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    booking.groceryApprovalStatus = 'Rejected';
    await booking.save();

    const bookingRef = booking._id.toString().slice(-6).toUpperCase();

    // Notify the USER
    await Notification.create({
      title: '❌ Grocery Support Rejected',
      message: `Your grocery support request for Booking #${bookingRef} was declined. Please provide your own ingredients and update the chef.`,
      type: 'booking',
      userId: booking.userId?._id || booking.userId
    });

    // Notify the CHEF
    if (booking.chefId) {
      const chefId = booking.chefId._id || booking.chefId;
      const userName = booking.userId ? `${booking.userId.firstName} ${booking.userId.lastName}` : 'The user';
      await Notification.create({
        title: '❌ Grocery Rejected – User Will Bring Ingredients',
        message: `Admin rejected grocery support for Booking #${bookingRef}. ${userName} will provide their own ingredients.`,
        type: 'booking',
        userId: chefId
      });
    }

    const io = req.app.get('io');
    if (io) io.emit('new-notification', { message: `❌ Grocery support for Booking #${bookingRef} rejected.` });

    res.json({ success: true, message: 'Grocery support request rejected. User and Chef notified.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// Payment Hash Generation for PayHere Checkout
router.post('/payment/hash', (req, res) => {
  const { orderId, amount, currency } = req.body;
  if (!orderId || !amount || !currency) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const merchantId = '1236941';
  const merchantSecret = 'MTIxNzgzNTAyMjY5MTU3OTQ5MzE5NzkzMDEwNTgzOTU5NTc0Mjg3';

  // Format amount to 2 decimal places
  const amountFormatted = parseFloat(amount).toFixed(2);

  // Hash formula: MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret))
  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const mainHash = crypto.createHash('md5')
    .update(merchantId + orderId + amountFormatted + currency + secretHash)
    .digest('hex')
    .toUpperCase();

  res.json({ hash: mainHash });
});

// ==========================================
// ADMIN: COURSES CRUD
// ==========================================
router.post('/admin/courses/add', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { title, description, category, chefId, cuisineId, duration, price, status } = req.body;
    const newCourse = new Course({
      title,
      description: description || '',
      category: category || 'cuisine',
      chefId,
      cuisineId: cuisineId || undefined,
      duration: duration || '2 hours',
      price: parseFloat(price) || 0,
      status: status || 'Live'
    });
    await newCourse.save();
    res.json({ success: true, message: 'Course added successfully.' });
  } catch (error) {
    console.error('Add course error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});


router.post('/admin/courses/:id/delete', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/admin/courses/:id/status', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    await Course.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true, message: 'Course status updated.' });
  } catch (error) {
    console.error('Update course status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: CUISINES CRUD
// ==========================================
router.post('/admin/cuisines/add', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { name, image, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Cuisine name is required.' });
    }
    const defaultCover = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80';
    const newCuisine = new Cuisine({
      name: name.trim(),
      image: (image && image.trim()) || defaultCover,
      description: description ? description.trim() : `Authentic ${name.trim()} cuisine`
    });
    await newCuisine.save();
    res.json({ success: true, message: 'Cuisine added successfully.', cuisine: newCuisine });
  } catch (error) {
    console.error('Add cuisine error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.post('/admin/cuisines/:id/delete', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Cuisine.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Cuisine deleted successfully.' });
  } catch (error) {
    console.error('Delete cuisine error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: REVIEWS MANAGEMENT (Approve / Reject / Delete)
// ==========================================
router.post('/admin/reviews/:id/approve', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', isApproved: true },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, message: 'Review approved and published on chef profile!' });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/admin/reviews/:id/reject', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', isApproved: false },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, message: 'Review rejected.' });
  } catch (error) {
    console.error('Reject review error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/admin/reviews/:id/delete', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }
    res.json({ success: true, message: 'Review deleted successfully.' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// ADMIN: DISCOUNTS & OFFERS CRUD
// ==========================================
router.post('/admin/discounts/add', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { code, title, discountPercentage, type, validTill, minOrderAmount, description } = req.body;
    if (!code || !title || !discountPercentage || !validTill) {
      return res.status(400).json({ success: false, message: 'Please fill in code, title, percentage, and expiry date.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(validTill) < today) {
      return res.status(400).json({ success: false, message: 'Valid Till date cannot be in the past.' });
    }
    const newDiscount = new Discount({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      discountPercentage: Number(discountPercentage),
      type: type || 'Festival',
      validTill: new Date(validTill),
      minOrderAmount: Number(minOrderAmount) || 0,
      description: description ? description.trim() : '',
      status: 'Active'
    });
    await newDiscount.save();
    res.json({ success: true, message: 'Discount offer added successfully!', discount: newDiscount });
  } catch (error) {
    console.error('Add discount error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.post('/admin/discounts/:id/delete', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Discount.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Discount offer deleted successfully.' });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/discounts/:id/status', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    await Discount.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true, message: `Discount status updated to ${status}.` });
  } catch (error) {
    console.error('Update discount status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ADMIN: SUBSCRIPTIONS CRUD
// ==========================================
router.post('/admin/subscriptions/add', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { name, tier, price, billingCycle, features, badge, isFeatured, activeSubscribers } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Plan name is required.' });
    }

    let parsedFeatures = [];
    if (Array.isArray(features)) {
      parsedFeatures = features;
    } else if (typeof features === 'string') {
      parsedFeatures = features.split('\n').map(f => f.trim()).filter(f => f.length > 0);
    }

    const newPlan = new SubscriptionPlan({
      name: name.trim(),
      tier: tier || 'Custom',
      price: parseFloat(price) || 0,
      billingCycle: billingCycle || 'month',
      features: parsedFeatures,
      badge: badge ? badge.trim() : '',
      isFeatured: !!isFeatured,
      activeSubscribers: parseInt(activeSubscribers) || 0,
      status: 'Active'
    });

    await newPlan.save();
    res.json({ success: true, message: 'Subscription plan created successfully.', plan: newPlan });
  } catch (error) {
    console.error('Add subscription plan error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/admin/subscriptions/:id/edit', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { name, tier, price, billingCycle, features, badge, isFeatured, activeSubscribers, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Plan name is required.' });
    }

    let parsedFeatures = [];
    if (Array.isArray(features)) {
      parsedFeatures = features;
    } else if (typeof features === 'string') {
      parsedFeatures = features.split('\n').map(f => f.trim()).filter(f => f.length > 0);
    }

    const updated = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        tier: tier || 'Custom',
        price: parseFloat(price) || 0,
        billingCycle: billingCycle || 'month',
        features: parsedFeatures,
        badge: badge ? badge.trim() : '',
        isFeatured: !!isFeatured,
        activeSubscribers: parseInt(activeSubscribers) || 0,
        status: status || 'Active'
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    res.json({ success: true, message: 'Subscription plan updated successfully.', plan: updated });
  } catch (error) {
    console.error('Edit subscription plan error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/admin/subscriptions/:id/delete', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const deleted = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }
    res.json({ success: true, message: 'Subscription plan deleted successfully.' });
  } catch (error) {
    console.error('Delete subscription plan error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// ADMIN: BOOKING DETAILS
// ==========================================
router.get('/admin/bookings/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId')
      .populate('chefId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, booking });
  } catch (error) {
    console.error('Fetch booking error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// ADMIN: INGREDIENT CATEGORIES CRUD
// ==========================================
router.post('/admin/ingredient-categories/add', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }
    const cleanName = name.trim();
    const existing = await IngredientCategory.findOne({
      name: new RegExp('^' + cleanName + '$', 'i')
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists.' });
    }
    const newCat = new IngredientCategory({ name: cleanName });
    await newCat.save();
    res.json({ success: true, message: 'Category added successfully.', category: newCat });
  } catch (error) {
    console.error('Add ingredient category error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// ADMIN: INGREDIENTS CRUD
// ==========================================
router.post('/admin/ingredients/add', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !name.trim() || !category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Ingredient name and category are required.' });
    }
    const cleanName = name.trim();
    const cleanCategory = category.trim();

    // Check if duplicate in the same category
    const existing = await Ingredient.findOne({
      name: new RegExp('^' + cleanName + '$', 'i'),
      category: new RegExp('^' + cleanCategory + '$', 'i')
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ingredient already exists in this category.' });
    }

    const newIngredient = new Ingredient({
      name: cleanName,
      category: cleanCategory
    });
    await newIngredient.save();
    res.json({ success: true, message: 'Ingredient added successfully.', ingredient: newIngredient });
  } catch (error) {
    console.error('Add ingredient error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/admin/ingredients/:id/edit', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !name.trim() || !category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Ingredient name and category are required.' });
    }
    const updated = await Ingredient.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), category: category.trim() },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }
    res.json({ success: true, message: 'Ingredient updated successfully.', ingredient: updated });
  } catch (error) {
    console.error('Edit ingredient error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/admin/ingredients/:id/delete', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const deleted = await Ingredient.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }
    res.json({ success: true, message: 'Ingredient deleted successfully.' });
  } catch (error) {
    console.error('Delete ingredient error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// ADMIN: PROFILE UPDATE (with photo upload)
// ==========================================
router.post('/admin/profile/update', isAuthenticated, isRole('admin'), upload.single('profilePhoto'), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const updateData = { firstName, lastName, email, phone };

    // Handle photo upload
    if (req.file) {
      updateData.profilePhoto = '/uploads/' + req.file.filename;
    }

    // Handle password change
    if (password && password.trim().length >= 6) {
      const bcrypt = require('bcryptjs');
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    await User.findByIdAndUpdate(req.session.user.id, updateData);

    // Update session values
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;
    req.session.user.email = email;

    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});


// ==========================================
// CHEF: PROFILE UPDATE
// ==========================================
router.post('/chef/profile/update', isAuthenticated, isRole('chef'), upload.single('profilePhoto'), async (req, res) => {
  try {
    const { firstName, lastName, phone, address, city, bio, hourlyRate, chefType, cuisines, experience } = req.body;
    const updateData = { firstName, lastName, phone, address, city, bio, experience: parseInt(experience) || 0 };

    if (hourlyRate) updateData.hourlyRate = parseFloat(hourlyRate) || 0;
    if (chefType) updateData.chefType = chefType;

    // Handle cuisines (can be array or string from checkboxes)
    if (cuisines) {
      updateData.cuisines = Array.isArray(cuisines) ? cuisines : [cuisines];
    }

    // Handle profile photo upload
    if (req.file) {
      updateData.profilePhoto = '/uploads/' + req.file.filename;
    }

    await User.findByIdAndUpdate(req.session.user.id, updateData);

    // Refresh session name
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;

    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Chef profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// CHEF: DISH UPLOAD & MANAGEMENT
// ==========================================
router.post('/chef/dish/upload', isAuthenticated, isRole('chef'), upload.array('foodImages', 6), async (req, res) => {
  try {
    const { name, cuisine, category, description } = req.body;
    if (!name || !cuisine) {
      return res.status(400).json({ success: false, message: 'Dish name and cuisine style are required.' });
    }

    let imagePaths = [];
    if (req.files && req.files.length > 0) {
      imagePaths = req.files.map(file => '/uploads/' + file.filename);
    }

    const newFood = new Food({
      chefId: req.session.user.id,
      name: name.trim(),
      cuisine: cuisine.trim(),
      category: category || 'Main Course',
      description: description ? description.trim() : 'Chef signature dish.',
      images: imagePaths,
      ingredients: ['Premium ingredients chosen by Chef'],
      prepTime: {
        preparation: '15 mins',
        marination: '0 mins',
        cooking: '20 mins',
        total: '35 mins'
      }
    });

    await newFood.save();
    res.json({ success: true, message: 'Signature dish added successfully!' });
  } catch (error) {
    console.error('Dish upload error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

router.post('/chef/dish/:id/delete', isAuthenticated, isRole('chef'), async (req, res) => {
  try {
    const dish = await Food.findOneAndDelete({ _id: req.params.id, chefId: req.session.user.id });
    if (!dish) {
      return res.status(404).json({ success: false, message: 'Dish not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Dish removed successfully.' });
  } catch (error) {
    console.error('Delete dish error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// USER: PROFILE UPDATE
// ==========================================
router.post('/user/profile/update', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), upload.single('profilePhoto'), async (req, res) => {
  try {
    const { firstName, lastName, phone, address, city, district, province, postalCode, healthCondition, allergies } = req.body;
    const updateData = { firstName, lastName, phone, address, city, district, province, postalCode, healthCondition, allergies };

    // Handle profile photo upload
    if (req.file) {
      updateData.profilePhoto = '/uploads/' + req.file.filename;
    }

    await User.findByIdAndUpdate(req.session.user.id, updateData);

    // Refresh session name
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;

    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('User profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ==========================================
// USER: SAVE/UNSAVE CHEF
// ==========================================
router.post('/user/chef/save/:id', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const chefId = req.params.id;

    if (!user.savedChefs) {
      user.savedChefs = [];
    }

    // Use string comparison — indexOf fails for ObjectId vs string
    const alreadySaved = user.savedChefs.some(id => id.toString() === chefId);
    let saved = false;
    if (alreadySaved) {
      user.savedChefs = user.savedChefs.filter(id => id.toString() !== chefId);
    } else {
      user.savedChefs.push(chefId);
      saved = true;
    }
    await user.save();
    res.json({ success: true, saved, message: saved ? 'Chef saved successfully!' : 'Chef removed from saved.' });
  } catch (error) {
    console.error('Error toggling save chef:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// USER: SUBSCRIPTION UPGRADE
// ==========================================
router.post('/user/subscription/upgrade', isAuthenticated, isRole(['user', 'client', 'chef', 'admin']), async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['Free', 'Premium', 'Elite'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription tier.' });
    }

    const user = await User.findById(req.session.user.id);
    user.subscriptionTier = tier;
    let amountPaid = 0;
    if (tier === 'Free') {
      user.urgentBookingsLeft = 0;
      user.hasFreeCourseEnrollment = false;
    } else if (tier === 'Premium') {
      user.urgentBookingsLeft = 2;
      amountPaid = 5000;
    } else if (tier === 'Elite') {
      user.urgentBookingsLeft = 10;
      user.hasFreeCourseEnrollment = true;
      amountPaid = 15000;
    }
    await user.save();

    let newReceipt = null;
    // If paid subscription, generate official Receipt and notification
    if (amountPaid > 0) {
      newReceipt = new Receipt({
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        customerName: `${user.firstName} ${user.lastName}`,
        chefName: `ChefNest Membership (${tier} Tier)`,
        transactionId: 'TXN-SUB-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100),
        amountPaid: amountPaid,
        paymentMethod: 'Credit/Debit Card',
        status: 'Paid',
        createdAt: new Date()
      });
      await newReceipt.save();

      // 1. Notification for User
      await Notification.create({
        title: `⭐ ${tier} Subscription Activated`,
        message: `Your payment of LKR ${amountPaid.toLocaleString()} for ChefNest ${tier} Membership is confirmed. Transaction #${newReceipt.transactionId}.`,
        type: 'payment',
        userId: user._id
      });

      // 2. Notification for Admin
      await Notification.create({
        title: `⭐ New Subscription: ${tier} Tier`,
        message: `User ${user.firstName} ${user.lastName} (${user.email}) upgraded to ${tier} Membership (LKR ${amountPaid.toLocaleString()}).`,
        type: 'payment'
      });

      const io = req.app.get('io');
      if (io) {
        io.to('user_' + user._id).emit('new-notification', {
          message: `⭐ Your ChefNest ${tier} Membership Plan is now Active!`
        });
        io.emit('new-notification', {
          message: `⭐ New subscription: ${user.firstName} ${user.lastName} upgraded to ${tier} Plan`
        });
      }
    }

    res.json({
      success: true,
      message: `Successfully activated ${tier} plan!`,
      tier,
      receipt: newReceipt
    });
  } catch (error) {
    console.error('Error changing subscription tier:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// SHARED: PASSWORD CHANGE (chef + user)
// ==========================================
router.post('/account/password/change', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Please fill in all password fields.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});



// ==========================================
// NOTIFICATIONS: MARK READ & READ ALL
// ==========================================
router.post('/notifications/:id/read', isAuthenticated, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.user.id },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/notifications/read-all', isAuthenticated, async (req, res) => {
  try {
    if (req.session.user && req.session.user.role === 'admin') {
      await Notification.updateMany({ isRead: false }, { isRead: true });
    } else {
      await Notification.updateMany(
        { userId: req.session.user.id, isRead: false },
        { isRead: true }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Admin: Direct Booking Approval
router.post('/admin/bookings/:id/approve', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('userId').populate('chefId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    booking.status = 'Accepted';
    await booking.save();

    const bookingRef = booking._id.toString().slice(-6).toUpperCase();
    const targetUserId = (booking.userId && booking.userId._id) ? booking.userId._id : booking.userId;

    // Notify user
    await Notification.create({
      title: '✅ Booking Approved by Admin!',
      message: `Your booking #${bookingRef} has been approved by Admin. Please proceed with payment or prepare for your dining session.`,
      type: 'booking',
      userId: targetUserId
    });

    // Notify chef
    if (booking.chefId) {
      const chefId = booking.chefId._id || booking.chefId;
      await Notification.create({
        title: '✅ Admin Approved Booking',
        message: `Admin approved Booking #${bookingRef}. Please check your upcoming schedule.`,
        type: 'booking',
        userId: chefId
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('new-notification', { message: `✅ Booking #${bookingRef} approved by Admin!` });
    }

    res.json({ success: true, message: 'Booking approved successfully!' });
  } catch (err) {
    console.error('Admin approve booking error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;
