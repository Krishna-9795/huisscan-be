import {
  BuyingStage,
  PropertyType,
  SubscriptionPlan,
  UserRole,
} from "@prisma/client";

export type PublicUserPreference = {
  budgetMin: number | null;
  budgetMax: number | null;
  preferredCities: string[];
  propertyType: PropertyType;
  bedroomsMin: number | null;
  buyingStage: BuyingStage;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  avatarColor: string;
  role: UserRole;
  plan: SubscriptionPlan;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUserProfile = Omit<PublicUser, "role" | "emailVerified"> & {
  preferences: PublicUserPreference;
};

export type UserListItem = PublicUser;
