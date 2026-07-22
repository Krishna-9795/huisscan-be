export type VatBreakdownInput = {
  amountCents: number;
  vatRateBps: number;
  vatType: VatPriceType;
};

export type VatPriceType = "ZERO" | "INCLUSIVE" | "EXCLUSIVE";

export function calculateVatBreakdown(input: VatBreakdownInput) {
  const amountCents = input.amountCents;
  const vatRateBps = input.vatType === "ZERO" ? 0 : input.vatRateBps;

  if (input.vatType === "INCLUSIVE" && vatRateBps > 0) {
    const vatAmountCents = Math.round(
      (amountCents * vatRateBps) / (10000 + vatRateBps),
    );
    const netAmountCents = amountCents - vatAmountCents;

    return {
      amountCents,
      netAmountCents,
      vatAmountCents,
      totalAmountCents: amountCents,
    };
  }

  const netAmountCents = amountCents;
  const vatAmountCents = Math.round((netAmountCents * vatRateBps) / 10000);
  const totalAmountCents = netAmountCents + vatAmountCents;

  return {
    amountCents,
    netAmountCents,
    vatAmountCents,
    totalAmountCents,
  };
}
