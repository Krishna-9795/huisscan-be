import { UserRole } from "@prisma/client";

import { sendSesEmail } from "../helpers/ses-email";
import { UserReportArtifactsRepository } from "../repositories/user-report-artifacts.repository";
import { ShareReportInput } from "../schemas/report-shares.schema";

type CurrentUser = {
  userId: number;
  email: string;
  role: UserRole;
};

export class ReportSharesService {
  private readonly userReportArtifactsRepository: UserReportArtifactsRepository;

  constructor(prisma: ConstructorParameters<typeof UserReportArtifactsRepository>[0]) {
    this.userReportArtifactsRepository = new UserReportArtifactsRepository(prisma);
  }

  async sharePaidReport(currentUser: CurrentUser, input: ShareReportInput) {
    const payment =
      await this.userReportArtifactsRepository.findLatestPaidPaymentForReport({
        userId: currentUser.userId,
        reportType: input.reportType,
        reportId: input.reportId,
      });

    if (!payment) {
      throw Object.assign(
        new Error("No paid report purchase was found for this user"),
        { statusCode: 404 },
      );
    }

    const reportLabel = getReportLabel(input.reportType);
    const address = input.address || payment.address || "the selected property";
    const fileName =
      input.fileName || getReportFileName(input.reportType, input.reportId);

    await sendSesEmail({
      to: input.recipientEmail,
      subject: `${reportLabel} - ${address}`,
      text: [
        `Hi,`,
        "",
        `${currentUser.email} shared a HuisValue ${reportLabel.toLowerCase()} with you.`,
        "",
        `Property: ${address}`,
        "",
        "The PDF report is attached to this email.",
      ].join("\n"),
      html: [
        "<p>Hi,</p>",
        `<p>${escapeHtml(currentUser.email)} shared a HuisValue ${escapeHtml(
          reportLabel.toLowerCase(),
        )} with you.</p>`,
        `<p><strong>Property:</strong> ${escapeHtml(address)}</p>`,
        "<p>The PDF report is attached to this email.</p>",
      ].join(""),
      attachments: [
        {
          filename: fileName,
          contentType: "application/pdf",
          contentBase64: normalizeBase64(input.pdfBase64),
        },
      ],
    });

    return {
      reportType: input.reportType,
      reportId: input.reportId,
      recipientEmail: input.recipientEmail,
      sent: true,
    };
  }
}

function getReportLabel(reportType: ShareReportInput["reportType"]) {
  return reportType === "last-sale-report"
    ? "Last sale report"
    : "Sold Home Benchmark Report";
}

function getReportFileName(reportType: string, reportId: string) {
  const safeReportId = reportId.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return `huisvalue-${reportType}-${safeReportId}.pdf`;
}

function normalizeBase64(value: string) {
  return value.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
