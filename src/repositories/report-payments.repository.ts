import { Prisma, PrismaClient } from "@prisma/client";

type CreateReportPaymentData = {
  userId?: string;
  molliePaymentId: string;
  checkoutToken: string;
  reportType: string;
  reportId: string;
  address?: string;
  amountCents: number;
  currency: string;
  status: string;
  checkoutUrl?: string;
  returnTo?: string;
  metadata?: Prisma.InputJsonValue;
};

type UpdateReportPaymentData = {
  status?: string;
  checkoutUrl?: string;
  invoiceId?: string;
  paidAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
};

export class ReportPaymentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateReportPaymentData) {
    return this.prisma.reportPayment.create({
      data,
    });
  }

  findByMolliePaymentId(molliePaymentId: string) {
    return this.prisma.reportPayment.findUnique({
      where: { molliePaymentId },
    });
  }

  findByCheckoutToken(checkoutToken: string) {
    return this.prisma.reportPayment.findUnique({
      where: { checkoutToken },
    });
  }

  findAllByUserId(userId: string) {
    return this.prisma.reportPayment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  findAll() {
    return this.prisma.reportPayment.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  updateByMolliePaymentId(
    molliePaymentId: string,
    data: UpdateReportPaymentData,
  ) {
    return this.prisma.reportPayment.update({
      where: { molliePaymentId },
      data,
    });
  }
}
