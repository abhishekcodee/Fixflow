import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

export const ALLOWED_ROLES = ['user', 'admin', 'technician'];

const attachMethods = (raw) => {
  if (!raw) return null;
  const user = { ...raw };
  user._id = user.id; // Backward compatibility with MongoDB _id
  user.comparePassword = async function (candidatePassword) {
    if (!this.passwordHash) {
      throw new Error('Password hash not loaded in user document.');
    }
    return bcrypt.compare(candidatePassword, this.passwordHash);
  };
  user.toSafeObject = function () {
    return {
      id: this.id,
      _id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      avatarUrl: this.avatarUrl || null,
      githubId: this.githubId || null,
      isActive: this.isActive,
      isVerified: this.isVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };
  user.save = async function () {
    const updated = await prisma.user.update({
      where: { id: this.id },
      data: {
        name: this.name,
        email: this.email,
        githubId: this.githubId || null,
        avatarUrl: this.avatarUrl || null,
        role: this.role,
        isActive: this.isActive,
        isVerified: this.isVerified
      }
    });
    Object.assign(this, attachMethods(updated));
    return this;
  };
  user.select = function () {
    return this;
  };
  return user;
};

class UserQueryBuilder {
  constructor(where = {}) {
    this._where = where;
  }

  select() {
    return this;
  }

  populate() {
    return this;
  }

  async exec() {
    const user = await prisma.user.findFirst({ where: this._where });
    return attachMethods(user);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

export class User {
  static async hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
  }

  static findOne(query = {}) {
    let where = {};
    if (query._id) where.id = String(query._id);
    else if (query.id) where.id = String(query.id);
    if (query.email) where.email = String(query.email).trim().toLowerCase();
    if (query.githubId) where.githubId = String(query.githubId);
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.$or && Array.isArray(query.$or)) {
      where.OR = query.$or.map((clause) => {
        const c = {};
        if (clause.id || clause._id) c.id = String(clause.id || clause._id);
        if (clause.email) c.email = String(clause.email).trim().toLowerCase();
        if (clause.githubId) c.githubId = String(clause.githubId);
        return c;
      });
    }

    return new UserQueryBuilder(where);
  }

  static findById(id) {
    if (!id) return new UserQueryBuilder({ id: '__invalid_null_id__' });
    return new UserQueryBuilder({ id: String(id) });
  }

  static async find(query = {}) {
    let where = {};
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isVerified !== undefined) where.isVerified = query.isVerified;

    const users = await prisma.user.findMany({ where });
    const results = users.map(attachMethods);

    results.select = function () {
      return this;
    };
    return results;
  }

  static async create(data) {
    const created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash || null,
        githubId: data.githubId || null,
        avatarUrl: data.avatarUrl || null,
        role: data.role || 'user',
        isActive: data.isActive !== undefined ? data.isActive : true,
        isVerified: data.isVerified !== undefined ? data.isVerified : false
      }
    });
    return attachMethods(created);
  }

  static async findByIdAndUpdate(id, update) {
    let data = { ...update };
    if (data.$set) data = { ...data.$set };
    delete data._id;
    delete data.id;

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data
    });
    return attachMethods(updated);
  }

  static async countDocuments(query = {}) {
    let where = {};
    if (query.role) where.role = query.role;
    return prisma.user.count({ where });
  }

  constructor(data) {
    Object.assign(this, attachMethods(data));
  }
}

export default User;
