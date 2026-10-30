import prisma from '../config/prisma.js';

export class AadhaarVerificationModel {
  /**
   * Finds verification record by User ID.
   * @param {string} userId
   */
  static async findByUserId(userId) {
    if (!userId) return null;
    return prisma.aadhaarVerification.findUnique({
      where: { userId: String(userId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            identityStatus: true
          }
        }
      }
    });
  }

  /**
   * Finds verification record by ID.
   * @param {string} id
   */
  static async findById(id) {
    if (!id) return null;
    return prisma.aadhaarVerification.findUnique({
      where: { id: String(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            identityStatus: true
          }
        }
      }
    });
  }

  /**
   * Checks if an identity hash is already verified by another user.
   * @param {string} identityHash
   * @param {string} currentUserId
   */
  static async findDuplicateHash(identityHash, currentUserId) {
    if (!identityHash) return null;
    return prisma.aadhaarVerification.findFirst({
      where: {
        identityHash,
        userId: { not: String(currentUserId) },
        verificationStatus: { in: ['VERIFIED', 'OTP_VERIFIED', 'PENDING_REVIEW'] }
      }
    });
  }

  /**
   * Creates or updates verification record upon initiating verification.
   */
  static async upsertInitiation({
    userId,
    aadhaarNumberMasked,
    identityHash,
    providerReference,
    consentAcceptedAt,
    verificationStatus = 'OTP_SENT'
  }) {
    const existing = await prisma.aadhaarVerification.findUnique({
      where: { userId: String(userId) }
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    if (existing) {
      return prisma.aadhaarVerification.update({
        where: { userId: String(userId) },
        data: {
          aadhaarNumberMasked,
          identityHash,
          providerReference,
          verificationStatus,
          consentAcceptedAt: consentAcceptedAt || existing.consentAcceptedAt || now,
          otpSentAt: now,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          resendAttempts: existing.resendAttempts + 1,
          lastResendAt: now
        }
      });
    }

    return prisma.aadhaarVerification.create({
      data: {
        userId: String(userId),
        aadhaarNumberMasked,
        identityHash,
        providerReference,
        verificationStatus,
        consentAcceptedAt: consentAcceptedAt || now,
        otpSentAt: now,
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
        resendAttempts: 0,
        lastResendAt: now
      }
    });
  }

  /**
   * Updates document references after front and back image upload.
   */
  static async updateDocuments({
    userId,
    frontKey,
    backKey,
    frontOriginalName,
    backOriginalName,
    frontMime,
    backMime,
    frontSize,
    backSize,
    verificationStatus
  }) {
    return prisma.aadhaarVerification.update({
      where: { userId: String(userId) },
      data: {
        frontDocumentKey: frontKey || undefined,
        backDocumentKey: backKey || undefined,
        frontDocumentOriginalName: frontOriginalName || undefined,
        backDocumentOriginalName: backOriginalName || undefined,
        frontDocumentMimeType: frontMime || undefined,
        backDocumentMimeType: backMime || undefined,
        frontDocumentSize: frontSize || undefined,
        backDocumentSize: backSize || undefined,
        documentsUploadedAt: new Date(),
        verificationStatus: verificationStatus || undefined
      }
    });
  }

  /**
   * Updates verification status and timestamp.
   */
  static async updateStatus(userId, { status, otpVerifiedAt, verifiedAt, rejectedAt, rejectionReason, reviewedById }) {
    return prisma.aadhaarVerification.update({
      where: { userId: String(userId) },
      data: {
        verificationStatus: status,
        otpVerifiedAt: otpVerifiedAt || undefined,
        verifiedAt: verifiedAt || undefined,
        rejectedAt: rejectedAt || undefined,
        rejectionReason: rejectionReason !== undefined ? rejectionReason : undefined,
        reviewedById: reviewedById || undefined
      }
    });
  }

  /**
   * Increments OTP attempt count.
   */
  static async incrementOtpAttempts(userId) {
    return prisma.aadhaarVerification.update({
      where: { userId: String(userId) },
      data: {
        otpAttempts: { increment: 1 }
      }
    });
  }

  /**
   * Lists verification requests for administrators with filtering and pagination.
   */
  static async listAdminVerifications({ status, limit = 50, page = 1 }) {
    const where = {};
    if (status && status !== 'ALL') {
      where.verificationStatus = status;
    }

    const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const [verifications, total] = await Promise.all([
      prisma.aadhaarVerification.findMany({
        where,
        take,
        skip,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              identityStatus: true
            }
          }
        }
      }),
      prisma.aadhaarVerification.count({ where })
    ]);

    return {
      verifications,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        pages: Math.ceil(total / take)
      }
    };
  }
}

export default AadhaarVerificationModel;
