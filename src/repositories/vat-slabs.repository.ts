import { PrismaClient } from "@prisma/client";

type CreateVatSlabData = {
  code: string;
  name: string;
  rateBps: number;
  vatType: "ZERO" | "INCLUSIVE" | "EXCLUSIVE";
  isActive: boolean;
};

type UpdateVatSlabData = Partial<CreateVatSlabData>;

export class VatSlabsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.vatSlab.findMany({
      orderBy: [{ isActive: "desc" }, { rateBps: "asc" }, { name: "asc" }],
    });
  }

  findById(id: number) {
    return this.prisma.vatSlab.findUnique({
      where: { id },
    });
  }

  findByCode(code: string) {
    return this.prisma.vatSlab.findUnique({
      where: { code },
    });
  }

  create(data: CreateVatSlabData) {
    return this.prisma.vatSlab.create({
      data,
    });
  }

  update(id: number, data: UpdateVatSlabData) {
    return this.prisma.vatSlab.update({
      where: { id },
      data,
    });
  }
}
