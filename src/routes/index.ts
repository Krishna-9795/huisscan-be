import { FastifyInstance } from "fastify";

import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import savedReportsRoutes from "./saved-reports.routes";
import invoicesRoutes from "./invoices.routes";
import soldHomeBenchmarkReportRoutes from "./sold-home-benchmark-report.routes";
import paymentsRoutes from "./payments.routes";
import userAddressSearchesRoutes from "./user-address-searches.routes";
import userReportArtifactsRoutes from "./user-report-artifacts.routes";
import kadasterDashboardRoutes from "./kadaster-dashboard.routes";
import uploadsRoutes from "./uploads.routes";
import reportPriceSettingsRoutes from "./report-price-settings.routes";
import funnelEventsRoutes from "./funnel-events.routes";
import reportSharesRoutes from "./report-shares.routes";

export default async function routes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(savedReportsRoutes, { prefix: "/saved-reports" });
  await app.register(invoicesRoutes, { prefix: "/invoices" });
  await app.register(userAddressSearchesRoutes, { prefix: "/address-searches" });
  await app.register(userReportArtifactsRoutes, { prefix: "/report-artifacts" });
  await app.register(kadasterDashboardRoutes, { prefix: "/kadaster-dashboard" });
  await app.register(reportPriceSettingsRoutes, { prefix: "/report-prices" });
  await app.register(reportSharesRoutes, { prefix: "/report-shares" });
  await app.register(funnelEventsRoutes, { prefix: "/funnel-events" });
  await app.register(soldHomeBenchmarkReportRoutes);
  await app.register(paymentsRoutes, { prefix: "/payments" });
  await app.register(uploadsRoutes, { prefix: "/uploads" });
}
