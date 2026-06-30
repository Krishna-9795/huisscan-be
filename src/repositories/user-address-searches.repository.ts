import { PrismaClient } from "@prisma/client";

type UpsertSearchData = {
  userId: number;
  reportType: string;
  reportId?: string;
  address: string;
  addressKey: string;
  lastPaymentId?: number;
  lastMolliePaymentId?: string;
  invoiceId?: number;
  paymentStatus: string;
  paidAt?: Date;
  freeAccessUntil?: Date;
};

export class UserAddressSearchesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByUserReportAndAddressKey({
    userId,
    reportType,
    addressKey,
  }: {
    userId: number;
    reportType: string;
    addressKey: string;
  }) {
    return this.prisma.userAddressSearch.findUnique({
      where: {
        userId_reportType_addressKey: {
          userId,
          reportType,
          addressKey,
        },
      },
    });
  }

  findAllByUserId(userId: number) {
    return this.prisma.userAddressSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  upsert(data: UpsertSearchData) {
    return this.prisma.userAddressSearch.upsert({
      where: {
        userId_reportType_addressKey: {
          userId: data.userId,
          reportType: data.reportType,
          addressKey: data.addressKey,
        },
      },
      update: {
        reportId: data.reportId,
        address: data.address,
        lastPaymentId: data.lastPaymentId,
        lastMolliePaymentId: data.lastMolliePaymentId,
        invoiceId: data.invoiceId,
        paymentStatus: data.paymentStatus,
        paidAt: data.paidAt,
        freeAccessUntil: data.freeAccessUntil,
      },
      create: data,
    });
  }
}
