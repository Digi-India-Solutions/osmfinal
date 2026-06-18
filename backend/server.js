import "dotenv/config";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
// import { connectDB } from "./Db/index.js";
import morgan from "morgan";
import helmet from "helmet";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===== Security headers (SAFE CONFIG) =====
app.use(
  helmet({
    crossOriginResourcePolicy: false, // IMPORTANT for uploads & admin
  })
);
app.disable("x-powered-by");



if (process.env.NODE_ENV === "development") {
  const morgan = await import("morgan");
  app.use(morgan.default("dev"));
}

app.use("/public/image", express.static(path.join(__dirname, "public/images")));
app.use("/public", express.static(path.join(__dirname, "public")));

app.set("trust proxy", true);
app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ limit: "1000mb", extended: true }));
app.use(cookieParser());
// app.use(morgan("dev"));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3000/",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.166.80:3001",

];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


// connectDB();

import adminRouter from "./src/admin/admin-routes.js";
import adminRoleRouter from "./src/system-settings/adminRole/adminRole-routes.js"
import categoryRouter from "./src/masters/category/category-routes.js"
import warehouseRouter from "./src/masters/warehouse/warehouse-routes.js";
import partyRouter from "./src/masters/parties/parties-routes.js";
import itemRouter from "./src/masters/items/items-routes.js";
import unitRouter from "./src/masters/unit/units-routes.js";
import salesInvoiceRoutes from "./src/sales/invoices/salesInvoice-routes.js";
import challanRoutes from "./src/sales/challans/challan-routes.js";
import saleReturnRoutes from "./src/sales/returns/saleReturn-routes.js";
import salesPaymentRoutes from "./src/sales/payments/salesPayment-routes.js";
import purchaseOrderRoutes from "./src/purchase/purchaseOrder/purchaseorder-routes.js"
import backupAndExportRoutes from "./src/system-settings/backupAndExport/backupExport-routes.js"
import GrnRoutes from "./src/purchase/GRN/grn-routes.js"
import purchaseInvoiceRoutes from "./src/purchase/invoice/invoice-routes.js";
import purchasePaymentRoutes from "./src/purchase/payment/payment-routes.js";
import purchaseReturnRoutes from "./src/purchase/returns/return-routes.js";
import gatePassRouter from "./src/inventory/gate pass/gatepass-routes.js";
import stockViewRouter from "./src/inventory/stock-view/stock-routes.js";
import stockEntriesRouter from "./src/inventory/entries/entries-routes.js";
import adjustmentRouter from "./src/inventory/adjustment/adjustment-routes.js";
import transferRouter from "./src/inventory/transfers/transfer-routes.js";
import companyRouter from "./src/system-settings/company/company-routes.js";
import dashboardRouter from "./src/dashboard/dashboard-routes.js";
import invoiceSettingsRouter from "./src/system-settings/invoice-settings/invoice-routes.js";
import reportsRouter from "./src/reports/reports-routes.js";
import barcodeRouter from "./src/barCodePrint/barCodePrint-routes.js"
import bomRoutes from './src/menufacturing/BOM/BOMcreate/bom-routes.js';
import workcenterRouter from "./src/masters/workcenter/workcenter-routes.js"
import machineRouter from "./src/masters/machines/machines-routes.js"
import shiftRouter from "./src/masters/shifts/shifts-router.js"
import operatorsRouter from "./src/masters/operators/operators-routes.js"
import costcontrolRouter from "./src/masters/costcontrol/costcontrol-routes.js"
import rejectioncoderouter from "./src/masters/rejectioncodes/rejectioncode-routes.js"
import downtimecodeRouter from "./src/masters/downtimecode/downtimecode-routes.js"
import itemVariantRoutes from './src/masters/items/itemVariant/itemVariantRoutes.js';
import qualityparameterRouter from "./src/masters/qualityparameter/qualityparameter-routes.js"
import inspectionchecklistRouter from "./src/masters/inspectionchecklist/inspectionchecklist-routes.js"
import routingRouter from "./src/masters/routing/routing-routes.js"
import productionOrderRoutes from './src/menufacturing/production/productionOrders/poductionOrder-routes.js';
import productionEntryRoutes from './src/menufacturing/Shop-floor/Production-entry-routes.js';
import machineDowntimeRoutes from './src/menufacturing/Shop-floor/machineDowntime/machine-downtimeRoutes.js';
import hashRouter from './src/admin/hash.routes.js'; 
import settingRoutes from './src/setting/settingRoutes.js'; 
import subjectRoutes from './src/Subject/subjectRoutes.js';

app.use('/backups', express.static(path.join(process.cwd(), 'backups')));
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/auth", adminRouter);
app.use('/api/v1/setting', settingRoutes);
app.use('/api/v1/auth', subjectRoutes);
app.use('/api/v1/hash', hashRouter); 
app.use("/api/v1/role", adminRoleRouter)
app.use("/api/v1/categories", categoryRouter)
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/warehouse", warehouseRouter);
app.use("/api/v1/party", partyRouter);
app.use("/api/v1/item", itemRouter);
app.use("/api/v1/unit", unitRouter);
app.use("/api/v1/work-centers", workcenterRouter)
app.use("/api/v1/machines", machineRouter)
app.use("/api/v1/shifts", shiftRouter)
app.use("/api/v1/operators", operatorsRouter)
app.use("/api/v1/cost-control", costcontrolRouter)
app.use("/api/v1/rejection-codes", rejectioncoderouter)
app.use("/api/v1/downtime-codes", downtimecodeRouter)
app.use("/api/v1/quality-parameters", qualityparameterRouter)
app.use("/api/v1/routings", routingRouter)
app.use("/api/v1/inspection-checklists", inspectionchecklistRouter)
app.use("/api/v1/sales-invoices", salesInvoiceRoutes);
app.use("/api/v1/challans", challanRoutes);
app.use("/api/v1/sale-returns", saleReturnRoutes);
app.use("/api/v1/sales-payments", salesPaymentRoutes);
app.use("/api/v1/purchase-order", purchaseOrderRoutes);
app.use("/api/v1/backup-export", backupAndExportRoutes)
app.use("/api/v1/grn", GrnRoutes);
app.use("/api/v1/purchase-invoice", purchaseInvoiceRoutes);
app.use("/api/v1/purchase-payment", purchasePaymentRoutes);
app.use("/api/v1/purchase-return", purchaseReturnRoutes);
app.use("/api/v1/gatepass", gatePassRouter);
app.use("/api/v1/adjustment", adjustmentRouter);
app.use("/api/v1/transfer", transferRouter);
app.use("/api/v1/stock-view", stockViewRouter);
app.use("/api/v1/entry", stockEntriesRouter);
app.use("/api/v1/dashboard", dashboardRouter)
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/invoice-settings", invoiceSettingsRouter);
app.use("/api/label-settings", barcodeRouter)
app.use('/api/v1/manufacturing/bom', bomRoutes);
app.use('/api/v1', itemVariantRoutes);
app.use('/api/v1/manufacturing/production-orders', productionOrderRoutes);
app.use('/api/v1/production-entries', productionEntryRoutes);
app.use('/api/v1/downtime-entries', machineDowntimeRoutes);
app.get("/", (req, res) => {
  res.send("Server is running");
});



app.get("/developer", (req, res) => {
  res.send(
    `<h1>It is great to see you on the server of <a href="https://www.linkedin.com/in/nitin-gupta-b7a9a02a1/">AASIB KHAN</a></h1>`
  );
});



const port = process.env.PORT || 7000;
app.listen(port, "127.0.0.1", () => {
  console.log({ message: `App is running on port ${port}` });
});

