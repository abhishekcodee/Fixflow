import prisma from './prisma.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

export const seedInitialData = async () => {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return;
    }

    logger.info('MySQL database is empty. Seeding initial accounts for local development...');

    const salt = await bcrypt.genSalt(10);
    const [adminHash, techHash, userHash] = await Promise.all([
      bcrypt.hash('Admin123!', salt),
      bcrypt.hash('Tech123!', salt),
      bcrypt.hash('User123!', salt)
    ]);

    const admin = await prisma.user.create({
      data: {
        name: 'System Administrator',
        email: 'admin@fixflow.com',
        passwordHash: adminHash,
        role: 'admin',
        isActive: true,
        isVerified: true
      }
    });

    const technician = await prisma.user.create({
      data: {
        name: 'Alex Rivera (Technician)',
        email: 'technician@fixflow.com',
        passwordHash: techHash,
        role: 'technician',
        isActive: true,
        isVerified: true
      }
    });

    const resident = await prisma.user.create({
      data: {
        name: 'Jordan Smith (Resident)',
        email: 'user@fixflow.com',
        passwordHash: userHash,
        role: 'user',
        isActive: true,
        isVerified: true
      }
    });

    // Create a sample complaint
    const complaintNumber = 'FIX-202610-0001';
    const complaint = await prisma.complaint.create({
      data: {
        complaintNumber,
        title: 'Water pressure drop in master bathroom',
        description: 'The hot water pressure dropped significantly since yesterday evening. No leaking noticed under sink.',
        category: 'plumbing',
        priority: 'high',
        status: 'assigned',
        building: 'Building B - North Wing',
        floor: '3rd Floor',
        room: 'Unit 304',
        locationDescription: 'Master bathroom shower line',
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Campus Facilities Sector 4',
        createdById: resident.id,
        assignedToId: technician.id,
        assignedAt: new Date()
      }
    });

    await prisma.complaintHistory.create({
      data: {
        complaintId: complaint.id,
        actorId: resident.id,
        action: 'CREATED',
        newState: {
          status: 'submitted',
          priority: 'high',
          complaintNumber: 'FIX-202610-0001'
        },
        note: 'Complaint submitted by requester.'
      }
    });

    await prisma.counter.upsert({
      where: { id: 'complaint_202610' },
      update: {},
      create: { id: 'complaint_202610', seq: 1 }
    });

    logger.info('Demo seed data created successfully in MySQL:');
    logger.info('  - Admin:      admin@fixflow.com / Admin123!');
    logger.info('  - Technician: technician@fixflow.com / Tech123!');
    logger.info('  - User:       user@fixflow.com / User123!');
  } catch (err) {
    logger.warn(`Failed to seed demo data in MySQL (non-fatal): ${err.message}`);
  }
};

export default seedInitialData;
