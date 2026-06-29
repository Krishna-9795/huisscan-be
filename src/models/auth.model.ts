import { UserRole } from "@prisma/client";

import { PublicUser } from "./user.model";

export type AuthTokenPayload = {
  userId: number;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  user: PublicUser;
  token: string;
};
