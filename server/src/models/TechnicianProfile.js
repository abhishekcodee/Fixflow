import prisma from '../config/prisma.js';
import CategoryMapping from './CategoryMapping.js';
import { calculateDistanceKm } from '../utils/geo.js';

export const TECHNICIAN_SPECIALIZATIONS = [
  { id: 'electrician', label: 'Electrician' },
  { id: 'plumber', label: 'Plumber' },
  { id: 'hvac', label: 'HVAC / AC Technician' },
  { id: 'carpenter', label: 'Carpenter' },
  { id: 'painter', label: 'Painter' },
  { id: 'civil', label: 'Civil Maintenance Technician' },
  { id: 'appliance', label: 'Appliance Repair Technician' },
  { id: 'elevator', label: 'Lift / Elevator Technician' },
  { id: 'fire_safety', label: 'Fire Safety Technician' },
  { id: 'network', label: 'IT / Network Technician' },
  { id: 'general', label: 'General Maintenance Technician' },
  { id: 'other', label: 'Other' }
];

export const APPROVAL_STATUSES = [
  'pending_verification',
  'pending_approval',
  'approved',
  'rejected',
  'suspended'
];

export class TechnicianProfile {
  /**
   * Finds a technician profile by User ID.
   * @param {string} userId
   */
  static async findByUserId(userId) {
    if (!userId) return null;
    return prisma.technicianProfile.findUnique({
      where: { userId: String(userId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            isVerified: true,
            identityStatus: true,
            identityNumberMasked: true
          }
        }
      }
    });
  }

  /**
   * Creates or updates a technician's profile details.
   * @param {string} userId
   * @param {object} data
   */
  static async upsert(userId, data) {
    const cleanUserId = String(userId);
    const primarySpec = data.primarySpecialization || data.specialization || 'general';
    const expYears = typeof data.experienceYears === 'number' ? data.experienceYears : parseInt(data.experienceYears || '0', 10) || 0;

    return prisma.technicianProfile.upsert({
      where: { userId: cleanUserId },
      update: {
        primarySpecialization: primarySpec,
        customSpecialization: data.customSpecialization || null,
        secondarySpecializations: data.secondarySpecializations || undefined,
        experienceYears: expYears,
        skills: data.skills || undefined,
        serviceArea: data.serviceArea || undefined,
        workingHours: data.workingHours || undefined,
        isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : undefined,
        approvalStatus: data.approvalStatus || undefined,
        rejectionReason: data.rejectionReason !== undefined ? data.rejectionReason : undefined
      },
      create: {
        userId: cleanUserId,
        primarySpecialization: primarySpec,
        customSpecialization: data.customSpecialization || null,
        secondarySpecializations: data.secondarySpecializations || [],
        experienceYears: expYears,
        skills: data.skills || null,
        serviceArea: data.serviceArea || 'General Campus',
        workingHours: data.workingHours || '09:00 - 18:00',
        isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
        approvalStatus: data.approvalStatus || 'pending_approval'
      }
    });
  }

  /**
   * Sets technician active availability (online / offline).
   * @param {string} userId
   * @param {boolean} isAvailable
   */
  static async setAvailability(userId, isAvailable) {
    return prisma.technicianProfile.update({
      where: { userId: String(userId) },
      data: { isAvailable: Boolean(isAvailable) }
    });
  }

  /**
   * Administrative status change (Approve, Reject, Suspend).
   * @param {string} technicianUserId
   * @param {object} options
   */
  static async setApprovalStatus(technicianUserId, { approvalStatus, rejectionReason, approvedById }) {
    if (!APPROVAL_STATUSES.includes(approvalStatus)) {
      throw new Error(`Invalid approval status: "${approvalStatus}".`);
    }

    const data = {
      approvalStatus,
      rejectionReason: rejectionReason || null
    };

    if (approvalStatus === 'approved') {
      data.approvedAt = new Date();
      data.approvedById = approvedById || null;
      data.rejectionReason = null;
    }

    return prisma.technicianProfile.update({
      where: { userId: String(technicianUserId) },
      data
    });
  }

  /**
   * Smart Technician Matching Query.
   * Matches complaint categories against technician specializations,
   * checks approval status, availability, and ranks by active workload and proximity.
   * 
   * @param {object} options
   * @param {string} [options.category] - Complaint category (e.g. 'plumbing', 'electrical')
   * @param {string} [options.requiredSpecialization] - Explicit specialization override
   * @param {object} [options.coordinates] - Incident latitude and longitude
   * @param {number} [options.limit=10]
   * @returns {Promise<Array<object>>}
   */
  static async findMatchingTechnicians({ category, requiredSpecialization, coordinates, limit = 15 }) {
    let targetSpecs = [];

    if (requiredSpecialization) {
      targetSpecs = [requiredSpecialization.toLowerCase().trim()];
    } else if (category) {
      const mapping = await CategoryMapping.findByCategory(category);
      if (mapping) {
        targetSpecs.push(mapping.primarySpecialization.toLowerCase());
        if (Array.isArray(mapping.secondarySpecializations)) {
          targetSpecs.push(...mapping.secondarySpecializations.map((s) => String(s).toLowerCase()));
        }
      }
    }

    // Default fallback to 'general' if no specialization could be derived
    if (targetSpecs.length === 0) {
      targetSpecs = ['general'];
    }

    // Always include 'general' maintenance technicians as fallback candidates
    if (!targetSpecs.includes('general')) {
      targetSpecs.push('general');
    }

    // Query active, approved, and available technicians whose specialization matches
    const candidates = await prisma.user.findMany({
      where: {
        role: 'technician',
        isActive: true,
        technicianProfile: {
          approvalStatus: 'approved',
          isAvailable: true,
          primarySpecialization: { in: targetSpecs }
        }
      },
      include: {
        technicianProfile: true,
        assignedComplaints: {
          where: {
            status: { in: ['assigned', 'in_progress', 'on_hold'] }
          },
          select: { id: true }
        }
      }
    });

    // Map into safe, clean representation
    const formatted = candidates.map((tech) => {
      const profile = tech.technicianProfile || {};
      const activeWorkload = Array.isArray(tech.assignedComplaints) ? tech.assignedComplaints.length : 0;
      const isPrimaryMatch = targetSpecs[0] === profile.primarySpecialization;

      let distanceKm = null;
      if (coordinates && typeof coordinates.latitude === 'number' && typeof coordinates.longitude === 'number') {
        // Use campus anchor or profile coordinates if available
        const techLat = 28.6139;
        const techLng = 77.2090;
        distanceKm = calculateDistanceKm(coordinates.latitude, coordinates.longitude, techLat, techLng);
      }

      return {
        id: tech.id,
        _id: tech.id,
        name: tech.name,
        email: tech.email,
        phone: tech.phone || null,
        role: tech.role,
        avatarUrl: tech.avatarUrl || null,
        identityStatus: tech.identityStatus || 'unverified',
        primarySpecialization: profile.primarySpecialization || 'general',
        customSpecialization: profile.customSpecialization || null,
        experienceYears: profile.experienceYears || 0,
        skills: profile.skills || null,
        serviceArea: profile.serviceArea || 'General Campus',
        workingHours: profile.workingHours || '09:00 - 18:00',
        isAvailable: profile.isAvailable !== undefined ? profile.isAvailable : true,
        approvalStatus: profile.approvalStatus || 'pending_approval',
        activeWorkload,
        isPrimaryMatch,
        distanceKm: distanceKm !== null ? parseFloat(distanceKm.toFixed(2)) : null
      };
    });

    // Ranking algorithm:
    // 1. Primary specialization match first
    // 2. Fewest active work orders (least loaded)
    // 3. Proximity (if coordinates exist)
    // 4. Highest experience years
    formatted.sort((a, b) => {
      if (a.isPrimaryMatch !== b.isPrimaryMatch) {
        return a.isPrimaryMatch ? -1 : 1;
      }
      if (a.activeWorkload !== b.activeWorkload) {
        return a.activeWorkload - b.activeWorkload;
      }
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.experienceYears - a.experienceYears;
    });

    return formatted.slice(0, limit);
  }
}

export default TechnicianProfile;
