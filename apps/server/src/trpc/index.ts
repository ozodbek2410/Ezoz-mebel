import { router } from "./trpc";
import { authRouter } from "./routers/auth.router";
import { currencyRouter } from "./routers/currency.router";
import { customerRouter } from "./routers/customer.router";
import { productRouter, categoryRouter } from "./routers/product.router";
import { warehouseRouter } from "./routers/warehouse.router";
import { saleRouter, paymentRouter } from "./routers/sale.router";
import { expenseRouter } from "./routers/expense.router";
import { reportRouter } from "./routers/report.router";
import { employeeRouter } from "./routers/employee.router";
import { workshopRouter } from "./routers/workshop.router";
import { settingsRouter } from "./routers/settings.router";
import { shiftRouter } from "./routers/shift.router";
import { supplierRouter } from "./routers/supplier.router";
import { serviceTypeRouter } from "./routers/service-type.router";
import { marketplaceOrderRouter } from "./routers/marketplace-order.router";

export const appRouter = router({
  auth: authRouter,
  currency: currencyRouter,
  customer: customerRouter,
  product: productRouter,
  category: categoryRouter,
  warehouse: warehouseRouter,
  sale: saleRouter,
  payment: paymentRouter,
  expense: expenseRouter,
  report: reportRouter,
  employee: employeeRouter,
  workshop: workshopRouter,
  settings: settingsRouter,
  shift: shiftRouter,
  supplier: supplierRouter,
  serviceType: serviceTypeRouter,
  marketplaceOrder: marketplaceOrderRouter,
});

export type AppRouter = typeof appRouter;
