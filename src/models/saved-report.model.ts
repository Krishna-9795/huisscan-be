import { Prisma } from "@prisma/client";

export type PublicSavedReport = {
  id: number;
  userId: number;
  propertyId: string;
  address: string;
  reportData: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};
