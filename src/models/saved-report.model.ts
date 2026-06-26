import { Prisma } from "@prisma/client";

export type PublicSavedReport = {
  id: string;
  userId: string;
  propertyId: string;
  address: string;
  reportData: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};
