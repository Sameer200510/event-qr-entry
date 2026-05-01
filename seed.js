require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for seeding...');

    // Delete existing standard users 
    await User.deleteMany({ username: { $in: ['admin', 'volunteer', 'entry', 'food'] } });

    const salt = await bcrypt.genSalt(10);
    
    await User.create({
      username: 'admin',
      password: await bcrypt.hash('admin123', salt),
      role: 'Admin'
    });

    await User.create({
      username: 'entry',
      password: await bcrypt.hash('entry123', salt),
      role: 'EntryVolunteer'
    });

    await User.create({
      username: 'food',
      password: await bcrypt.hash('food123', salt),
      role: 'FoodVolunteer'
    });

    console.log('Successfully created:');
    console.log('- Admin (admin / admin123)');
    console.log('- Entry Volunteer (entry / entry123)');
    console.log('- Food Volunteer (food / food123)');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedUsers();
