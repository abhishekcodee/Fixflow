import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

export const ALLOWED_ROLES = ['user', 'admin', 'technician'];

const attachMethods = (raw) => {
  if (!raw) return null;
  const user = { ...raw };

  const resolvedId = raw.id || raw._id;
  const idStr = resolvedId ? String(resolvedId) : undefined;
  user.id = idStr;
  user._id = idStr; // Backward compatibility with MongoDB _id

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

  user.toJSON = function () {
    return this.toSafeObject();
  };

  user.save = async function () {
    if (!this.id) {
      return this;
    }
    const updated = await prisma.user.update({
      where: { id: this.id },
      data: {
        name: this.name,
        email: this.email ? this.email.toLowerCase().trim() : undefined,
        passwordHash: this.passwordHash || undefined,
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
    const createData = {
      name: data.name,
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash || null,
      githubId: data.githubId || null,
      avatarUrl: data.avatarUrl || null,
      role: data.role || 'user',
      isActive: data.isActive !== undefined ? data.isActive : true,
      isVerified: data.isVerified !== undefined ? data.isVerified : false
    };

    if (data.id) {
      createData.id = String(data.id);
    } else if (data._id) {
      createData.id = String(data._id);
    }

    const created = await prisma.user.create({
      data: createData
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

  static async deleteMany(filter = {}) {
    let where = {};
    if (filter.email) {
      if (typeof filter.email === 'object' && filter.email.$in && Array.isArray(filter.email.$in)) {
        where.email = { in: filter.email.$in.map((e) => String(e).trim().toLowerCase()) };
      } else {
        where.email = String(filter.email).trim().toLowerCase();
      }
    }
    if (filter.role) where.role = filter.role;
    if (filter.id) {
      if (typeof filter.id === 'object' && filter.id.$in) {
        where.id = { in: filter.id.$in.map(String) };
      } else {
        where.id = String(filter.id);
      }
    }
    if (filter._id) {
      if (typeof filter._id === 'object' && filter._id.$in) {
        where.id = { in: filter._id.$in.map(String) };
      } else {
        where.id = String(filter._id);
      }
    }

    try {
      const res = await prisma.user.deleteMany({ where });
      return { deletedCount: res.count };
    } catch {
      return { deletedCount: 0 };
    }
  }

  static async deleteOne(filter = {}) {
    let where = {};
    if (filter.email) where.email = String(filter.email).trim().toLowerCase();
    if (filter.id || filter._id) where.id = String(filter.id || filter._id);
    try {
      await prisma.user.delete({ where });
      return { deletedCount: 1 };
    } catch {
      return { deletedCount: 0 };
    }
  }

  static async countDocuments(query = {}) {
    let where = {};
    if (query.role) where.role = query.role;
    return prisma.user.count({ where });
  }

  constructor(data = {}) {
    Object.assign(this, attachMethods(data));
  }

  toSafeObject() {
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
  }

  toJSON() {
    return this.toSafeObject();
  }
}

export default User;
