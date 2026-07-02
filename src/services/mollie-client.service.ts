import { env } from "../config/env";

type MollieAmount = {
  currency: string;
  value: string;
};

type MollieLinks = {
  checkout?: {
    href?: string;
  };
};

export type MolliePayment = {
  id: string;
  status: string;
  amount?: MollieAmount;
  paidAt?: string;
  metadata?: unknown;
  _links?: MollieLinks;
};

type CreateMolliePaymentInput = {
  amount: MollieAmount;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata: Record<string, unknown>;
};

type UpdateMolliePaymentInput = {
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
};

const MOLLIE_API_BASE_URL = "https://api.mollie.com/v2";

export class MollieClientService {
  async createPayment(input: CreateMolliePaymentInput) {
    return this.request<MolliePayment>("/payments", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getPayment(paymentId: string) {
    return this.request<MolliePayment>(
      `/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
      },
    );
  }

  async updatePayment(paymentId: string, input: UpdateMolliePaymentInput) {
    return this.request<MolliePayment>(
      `/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  }

  private async request<T>(
    path: string,
    init: Omit<RequestInit, "headers"> & { headers?: HeadersInit },
  ) {
    const apiKey = getMollieApiKey();
    const response = await fetch(`${MOLLIE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        "content-type": "application/json",
        ...init.headers,
      },
    });

    const responseText = await response.text();
    const payload = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
      const detail =
        typeof payload === "object" &&
        payload !== null &&
        "detail" in payload &&
        typeof payload.detail === "string"
          ? payload.detail
          : `Mollie request failed with status ${response.status}`;

      throw new MollieApiError(detail, response.status, payload);
    }

    return payload as T;
  }
}

export class MollieApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly payload: unknown,
  ) {
    super(message);
  }
}

function getMollieApiKey() {
  const apiKey = env.MOLLIE_API_KEY || env.MOLLIE_TEST_API_KEY;

  if (!apiKey) {
    throw new Error("MOLLIE_API_KEY or MOLLIE_TEST_API_KEY is required");
  }

  return apiKey;
}
