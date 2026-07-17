import { Prisma, PrismaClient, User, UserRole } from "@prisma/client";

type CreateUserData = {
  email: string;
  name?: string;
  phone?: string;
  city?: string;
  avatarColor?: string;
  passwordHash?: string;
  role?: UserRole;
  plan?: "FREE" | "PRO";
};

type CreateUserPreferenceData = {
  budgetMin?: number;
  budgetMax?: number;
  preferredCities: string[];
  propertyType: "ANY" | "APARTMENT" | "HOUSE" | "TOWNHOUSE";
  bedroomsMin?: number;
  buyingStage: "EXPLORING" | "SEARCHING" | "VIEWING" | "OFFER_MADE" | "PURCHASED";
};

type UpdateUserData = {
  email?: string;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  avatarColor?: string;
};

type UpdateUserPreferenceData = {
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredCities?: string[];
  propertyType?: "ANY" | "APARTMENT" | "HOUSE" | "TOWNHOUSE";
  bedroomsMin?: number | null;
  buyingStage?: "EXPLORING" | "SEARCHING" | "VIEWING" | "OFFER_MADE" | "PURCHASED";
};

export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findProfileById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { preferences: true },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: CreateUserData) {
    return this.prisma.user.create({
      data,
    });
  }

  createProfile(data: CreateUserData, preferences: CreateUserPreferenceData) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data,
      });

      const userPreferences = await tx.userPreference.create({
        data: {
          userId: user.id,
          ...preferences,
        },
      });

      return {
        ...user,
        preferences: userPreferences,
      };
    });
  }

  update(id: number, data: UpdateUserData) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
      },
    });
  }

  updateProfile(
    id: number,
    data: UpdateUserData,
    preferences?: UpdateUserPreferenceData,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data,
      });

      if (preferences) {
        await tx.userPreference.upsert({
          where: { userId: id },
          update: preferences,
          create: {
            userId: id,
            preferredCities: preferences.preferredCities ?? [],
            ...preferences,
          },
        });
      }

      const user = await tx.user.findUnique({
        where: { id },
        include: { preferences: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    });
  }
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: user.city,
    avatarColor: user.avatarColor,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type UserWithPreferences = Prisma.UserGetPayload<{
  include: { preferences: true };
}>;

export function toPublicUserProfile(user: UserWithPreferences) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: user.city,
    avatarColor: user.avatarColor,
    role: user.role,
    plan: user.plan,
    preferences: {
      budgetMin: user.preferences?.budgetMin ?? null,
      budgetMax: user.preferences?.budgetMax ?? null,
      preferredCities: user.preferences?.preferredCities ?? [],
      propertyType: user.preferences?.propertyType ?? "ANY",
      bedroomsMin: user.preferences?.bedroomsMin ?? null,
      buyingStage: user.preferences?.buyingStage ?? "EXPLORING",
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
