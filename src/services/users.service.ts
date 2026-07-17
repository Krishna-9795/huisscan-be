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
}
