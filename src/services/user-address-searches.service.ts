import { PrismaClient, UserAddressSearch } from "@prisma/client";

import { ReportType } from "../schemas/payments.schema";
import { UserAddressSearchesRepository } from "../repositories/user-address-searches.repository";

type CheckAddressAccessInput = {
  userId: number;
  reportType: ReportType;
  address: string;
};

type RecordAddressSearchInput = {
  userId: number;
  reportType: ReportType;
  reportId?: string;
  address: string;
  paymentStatus: string;
  lastPaymentId?: number;
  lastMolliePaymentId?: string;
  invoiceId?: number;
  paidAt?: Date;
};

const FREE_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class UserAddressSearchesService {
  private readonly userAddressSearchesRepository: UserAddressSearchesRepository;

  constructor(prisma: PrismaClient) {
    this.userAddressSearchesRepository =
      new UserAddressSearchesRepository(prisma);
  }

  async checkAccess({ userId, reportType, address }: CheckAddressAccessInput) {
    const addressKey = normalizeAddressKey(address);
    const search =
      await this.userAddressSearchesRepository.findByUserReportAndAddressKey({
        userId,
        reportType,
        addressKey,
      });

    return toAccessResponse(search);
  }

  async getAllForUser(userId: number) {
    const searches =
      await this.userAddressSearchesRepository.findAllByUserId(userId);

    return searches.map(toPublicAddressSearch);
  }

  async recordSearch(input: RecordAddressSearchInput) {
    const paidAt = input.paidAt;
    const freeAccessUntil = paidAt
      ? new Date(paidAt.getTime() + FREE_REUSE_WINDOW_MS)
      : undefined;

    return this.userAddressSearchesRepository.upsert({
      userId: input.userId,
      reportType: input.reportType,
      reportId: input.reportId,
      address: input.address,
      addressKey: normalizeAddressKey(input.address),
      lastPaymentId: input.lastPaymentId,
      lastMolliePaymentId: input.lastMolliePaymentId,
      invoiceId: input.invoiceId,
      paymentStatus: input.paymentStatus,
      paidAt,
      freeAccessUntil,
    });
  }
}

export function normalizeAddressKey(address: string) {
  return address
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function toAccessResponse(search: UserAddressSearch | null) {
  const now = new Date();
  const freeAccessUntil = search?.freeAccessUntil ?? null;
  const hasAccess =
    freeAccessUntil !== null &&
    search?.paymentStatus === "paid" &&
    freeAccessUntil > now;

  return {
    hasAccess,
    requiresPayment: !hasAccess,
    accessExpiresAt: hasAccess ? freeAccessUntil : null,
    search: search ? toPublicAddressSearch(search) : null,
  };
}

function toPublicAddressSearch(search: UserAddressSearch) {
  return {
    id: search.id,
    userId: search.userId,
    reportType: search.reportType,
    reportId: search.reportId,
    address: search.address,
    addressKey: search.addressKey,
    lastPaymentId: search.lastPaymentId,
    lastMolliePaymentId: search.lastMolliePaymentId,
    invoiceId: search.invoiceId,
    paymentStatus: search.paymentStatus,
    paidAt: search.paidAt,
    freeAccessUntil: search.freeAccessUntil,
    createdAt: search.createdAt,
    updatedAt: search.updatedAt,
  };
}
