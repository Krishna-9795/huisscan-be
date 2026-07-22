import { Prisma, PrismaClient, VatSlab } from "@prisma/client";

import {
  CreateVatSlabInput,
  UpdateVatSlabInput,
} from "../schemas/vat-slabs.schema";
import { VatSlabsRepository } from "../repositories/vat-slabs.repository";

export class VatSlabsService {
  private readonly vatSlabsRepository: VatSlabsRepository;

  constructor(prisma: PrismaClient) {
    this.vatSlabsRepository = new VatSlabsRepository(prisma);
  }

  async getAll() {
    const slabs = await this.vatSlabsRepository.findAll();
    return slabs.map(toPublicVatSlab);
  }

  async create(input: CreateVatSlabInput) {
    try {
      const slab = await this.vatSlabsRepository.create(input);
      return {
        status: "created" as const,
        slab: toPublicVatSlab(slab),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          status: "conflict" as const,
        };
      }

      throw error;
    }
  }

  async update(id: number, input: UpdateVatSlabInput) {
    const existing = await this.vatSlabsRepository.findById(id);
    if (!existing) {
      return {
        status: "not_found" as const,
      };
    }

    try {
      const slab = await this.vatSlabsRepository.update(id, input);
      return {
        status: "ok" as const,
        slab: toPublicVatSlab(slab),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          status: "conflict" as const,
        };
      }

      throw error;
    }
  }
}

function toPublicVatSlab(slab: VatSlab) {
  return {
    id: slab.id,
    code: slab.code,
    name: slab.name,
    rateBps: slab.rateBps,
    ratePercent: slab.rateBps / 100,
    vatType: slab.vatType,
    isActive: slab.isActive,
    createdAt: slab.createdAt,
    updatedAt: slab.updatedAt,
  };
}
