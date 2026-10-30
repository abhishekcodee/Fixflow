import prisma from '../config/prisma.js';

export const DEFAULT_CATEGORY_MAPPINGS = [
  {
    category: 'electrical',
    label: 'Electrical & Lighting',
    primarySpecialization: 'electrician',
    secondarySpecializations: ['general'],
    description: 'Electrical fixtures, wiring, short circuits, tripped breakers, and lighting'
  },
  {
    category: 'plumbing',
    label: 'Plumbing & Drainage',
    primarySpecialization: 'plumber',
    secondarySpecializations: ['general'],
    description: 'Water leaks, pipe blockage, drainage, fixtures, taps, and water pressure'
  },
  {
    category: 'hvac',
    label: 'HVAC & Climate Control',
    primarySpecialization: 'hvac',
    secondarySpecializations: ['appliance', 'general'],
    description: 'Air conditioners, heaters, thermostats, ventilation, and cooling'
  },
  {
    category: 'carpentry',
    label: 'Carpentry & Doors/Windows',
    primarySpecialization: 'carpenter',
    secondarySpecializations: ['general'],
    description: 'Doors, windows, handles, hinges, broken wooden furniture, and locks'
  },
  {
    category: 'appliance',
    label: 'Appliances & Equipment',
    primarySpecialization: 'appliance',
    secondarySpecializations: ['electrician', 'general'],
    description: 'Refrigerators, washing machines, microwaves, water purifiers, and gym machines'
  },
  {
    category: 'safety_security',
    label: 'Safety & Security',
    primarySpecialization: 'fire_safety',
    secondarySpecializations: ['electrician', 'general'],
    description: 'Fire extinguishers, smoke alarms, emergency exits, access control, and cameras'
  },
  {
    category: 'cleaning',
    label: 'Janitorial & Cleaning',
    primarySpecialization: 'general',
    secondarySpecializations: ['civil'],
    description: 'Deep cleaning, spills, sanitation, waste management, and pest control'
  },
  {
    category: 'other',
    label: 'Other General Maintenance',
    primarySpecialization: 'general',
    secondarySpecializations: ['other'],
    description: 'Miscellaneous campus facility maintenance tasks'
  }
];

export class CategoryMapping {
  /**
   * Seeds default category mappings if table is empty.
   */
  static async seedDefaultsIfEmpty() {
    try {
      const count = await prisma.categoryMapping.count();
      if (count === 0) {
        for (const item of DEFAULT_CATEGORY_MAPPINGS) {
          await prisma.categoryMapping.create({
            data: {
              category: item.category,
              label: item.label,
              primarySpecialization: item.primarySpecialization,
              secondarySpecializations: item.secondarySpecializations,
              description: item.description
            }
          });
        }
      }
    } catch {
      // In case of race conditions during multi-instance startup
    }
  }

  /**
   * Finds mapping by complaint category.
   * @param {string} category
   */
  static async findByCategory(category) {
    if (!category) return null;
    const normalized = category.trim().toLowerCase();

    try {
      const mapping = await prisma.categoryMapping.findUnique({
        where: { category: normalized }
      });
      if (mapping) return mapping;
    } catch {
      // Fallback to in-memory default if database read encounters an issue
    }

    return DEFAULT_CATEGORY_MAPPINGS.find((m) => m.category === normalized) || {
      category: normalized,
      label: normalized,
      primarySpecialization: 'general',
      secondarySpecializations: ['other'],
      description: 'Default general maintenance fallback'
    };
  }

  /**
   * Returns all category mappings.
   */
  static async getAll() {
    try {
      await CategoryMapping.seedDefaultsIfEmpty();
      return await prisma.categoryMapping.findMany({
        orderBy: { category: 'asc' }
      });
    } catch {
      return DEFAULT_CATEGORY_MAPPINGS;
    }
  }

  /**
   * Updates category mapping (Admin only).
   */
  static async updateMapping(category, data) {
    const normalized = category.trim().toLowerCase();
    return prisma.categoryMapping.upsert({
      where: { category: normalized },
      update: {
        label: data.label,
        primarySpecialization: data.primarySpecialization,
        secondarySpecializations: data.secondarySpecializations || undefined,
        description: data.description || undefined
      },
      create: {
        category: normalized,
        label: data.label || normalized,
        primarySpecialization: data.primarySpecialization || 'general',
        secondarySpecializations: data.secondarySpecializations || [],
        description: data.description || null
      }
    });
  }
}

export default CategoryMapping;
