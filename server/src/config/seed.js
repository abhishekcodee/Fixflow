import { User } from '../models/User.js';
import { Complaint } from '../models/Complaint.js';
import { getNextComplaintNumber } from '../models/Counter.js';
import { logger } from '../utils/logger.js';

/**
 * Seeds initial demo accounts and complaints if the database is newly created or empty.
 */
export const seedInitialData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    logger.info('Database is empty. Seeding initial accounts for local development...');

    const [adminPasswordHash, techPasswordHash, userPasswordHash] = await Promise.all([
      User.hashPassword('Admin123!'),
      User.hashPassword('Tech123!'),
      User.hashPassword('User123!')
    ]);

    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@fixflow.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    const technician = await User.create({
      name: 'Alex Rivera (Technician)',
      email: 'technician@fixflow.com',
      passwordHash: techPasswordHash,
      role: 'technician',
      isActive: true,
      isVerified: true
    });

    const resident = await User.create({
      name: 'Jordan Smith (Resident)',
      email: 'user@fixflow.com',
      passwordHash: userPasswordHash,
      role: 'user',
      isActive: true,
      isVerified: true
    });

    // Create a sample complaint
    const complaintNumber = await getNextComplaintNumber();
    await Complaint.create({
      complaintNumber,
      title: 'Water pressure drop in master bathroom',
      description: 'The hot water pressure dropped significantly since yesterday evening. No leaking noticed under sink.',
      category: 'plumbing',
      priority: 'high',
      status: 'assigned',
      location: {
        building: 'Building B - North Wing',
        floor: '3rd Floor',
        room: 'Unit 304',
        description: 'Master bathroom shower line'
      },
      createdBy: resident._id,
      assignedTo: technician._id,
      assignedAt: new Date()
    });

    logger.info('Demo seed data created successfully:');
    logger.info('  - Admin:      admin@fixflow.com / Admin123!');
    logger.info('  - Technician: technician@fixflow.com / Tech123!');
    logger.info('  - User:       user@fixflow.com / User123!');
  } catch (err) {
    logger.warn(`Failed to seed demo data (non-fatal): ${err.message}`);
  }
};

export default seedInitialData;
