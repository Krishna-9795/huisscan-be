import { FastifyInstance } from "fastify";

import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import savedReportsRoutes from "./saved-reports.routes";
import invoicesRoutes from "./invoices.routes";
import soldHomeBenchmarkReportRoutes from "./sold-home-benchmark-report.routes";
import paymentsRoutes from "./payments.routes";
import userAddressSearchesRoutes from "./user-address-searches.routes";
import kadasterDashboardRoutes from "./kadaster-dashboard.routes";

export default async function routes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(savedReportsRoutes, { prefix: "/saved-reports" });
  await app.register(invoicesRoutes, { prefix: "/invoices" });
  await app.register(userAddressSearchesRoutes, { prefix: "/address-searches" });
  await app.register(kadasterDashboardRoutes, { prefix: "/kadaster-dashboard" });
  await app.register(soldHomeBenchmarkReportRoutes);
  await app.register(paymentsRoutes, { prefix: "/payments" });
}
