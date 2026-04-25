require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for seeding...');

    // Delete existing standard users 
    await User.deleteMany({ username: { $in: ['admin', 'volunteer'] } });

    const salt = await bcrypt.genSalt(10);
    const hashedAdminPassword = await bcrypt.hash('admin123', salt);
    const hashedVolunteerPassword = await bcrypt.hash('volunteer123', salt);

    await User.create({
      username: 'admin',
      password: hashedAdminPassword,
      role: 'Admin'
    });

    await User.create({
      username: 'volunteer',
      password: hashedVolunteerPassword,
      role: 'Volunteer'
    });

    console.log('Successfully created Admin (admin / admin123) and Volunteer (volunteer / volunteer123)');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedUsers();
