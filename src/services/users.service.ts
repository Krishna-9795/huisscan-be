import { PrismaClient } from "@prisma/client";

import {
  UsersRepository,
  toPublicUser,
  toPublicUserProfile,
} from "../repositories/users.repository";
import {
  CreateUserProfileInput,
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

  async getCurrentUser(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return toPublicUser(user);
  }

  async updateCurrentUser(userId: string, input: UpdateUserInput) {
    const user = await this.usersRepository.update(userId, input);
    return toPublicUser(user);
  }

  async getAllUsers() {
    const users = await this.usersRepository.findAll();
    return users.map(toPublicUser);
  }

  async getUserById(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      return null;
    }

    return toPublicUser(user);
  }
}
