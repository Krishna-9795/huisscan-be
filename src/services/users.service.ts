import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../helpers/password";
import {
  UsersRepository,
  toPublicUser,
  toPublicUserProfile,
} from "../repositories/users.repository";
import {
  CreateAdminUserInput,
  CreateUserProfileInput,
  UpdateAdminPasswordInput,
  UpdateAdminUserInput,
  UpdateUserInput,
} from "../schemas/users.schema";

export class UsersService {
  private readonly usersRepository: UsersRepository;

  constructor(prisma: PrismaClient) {
    this.usersRepository = new UsersRepository(prisma);
  }

  async createUserProfile(input: CreateUserProfileInput) {
    const email = input.email.toLowerCase();
    const existingUser = await this.usersRepository.findByEmail(email);

    if (existingUser) {
      return null;
    }

    const preferences = {
      budgetMin: input.preferences?.budgetMin,
      budgetMax: input.preferences?.budgetMax,
      preferredCities: input.preferences?.preferredCities ?? [],
      propertyType: input.preferences?.propertyType ?? "ANY",
      bedroomsMin: input.preferences?.bedroomsMin,
      buyingStage: input.preferences?.buyingStage ?? "EXPLORING",
    };

    const user = await this.usersRepository.createProfile(
      {
        email,
        name: input.name,
        phone: input.phone,
        city: input.city,
        avatarColor: input.avatarColor,
        plan: input.plan,
      },
      preferences,
    );

    return toPublicUserProfile(user);
  }

  async getCurrentUser(userId: number) {
    const user = await this.usersRepository.findProfileById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return toPublicUserProfile(user);
  }

  async updateCurrentUser(userId: number, input: UpdateUserInput) {
    const { preferences, email, ...userInput } = input;
    const user = await this.usersRepository.updateProfile(
      userId,
      {
        ...userInput,
        ...(email ? { email: email.toLowerCase() } : {}),
      },
      preferences,
    );

    return toPublicUserProfile(user);
  }

  async getAllUsers() {
    const users = await this.usersRepository.findAll();
    return users.map(toPublicUser);
  }

  async getUserById(id: number) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      return null;
    }

    return toPublicUser(user);
  }

  async getAllAdmins() {
    const users = await this.usersRepository.findAllByRole("ADMIN");
    return users.map(toPublicUser);
  }

  async getAdminById(id: number) {
    const user = await this.usersRepository.findById(id);

    if (!user || user.role !== "ADMIN") {
      return null;
    }

    return toPublicUser(user);
  }

  async createAdmin(input: CreateAdminUserInput) {
    const email = input.email.toLowerCase();
    const existingUser = await this.usersRepository.findByEmail(email);

    if (existingUser) {
      return null;
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.usersRepository.create({
      email,
      name: input.name,
      phone: input.phone ?? undefined,
      city: input.city ?? undefined,
      avatarColor: input.avatarColor,
      plan: input.plan,
      role: "ADMIN",
      passwordHash,
    });

    return toPublicUser(user);
  }

  async updateAdmin(id: number, input: UpdateAdminUserInput) {
    const existingUser = await this.usersRepository.findById(id);

    if (!existingUser || existingUser.role !== "ADMIN") {
      return { status: "not-found" as const };
    }

    if (input.email) {
      const nextEmail = input.email.toLowerCase();
      const emailOwner = await this.usersRepository.findByEmail(nextEmail);

      if (emailOwner && emailOwner.id !== id) {
        return { status: "email-conflict" as const };
      }
    }

    const user = await this.usersRepository.update(id, {
      ...input,
      ...(input.email ? { email: input.email.toLowerCase() } : {}),
    });

    return { status: "updated" as const, user: toPublicUser(user) };
  }

  async updateAdminPassword(id: number, input: UpdateAdminPasswordInput) {
    const existingUser = await this.usersRepository.findById(id);

    if (!existingUser || existingUser.role !== "ADMIN") {
      return null;
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.usersRepository.update(id, { passwordHash });

    return toPublicUser(user);
  }
}
