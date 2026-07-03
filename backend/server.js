import 'dotenv/config';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===== Security headers =====
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: [
          "'self'",
          'http://localhost:3000',
          'http://localhost:3001',
        ],
        frameSrc: ["'self'", 'http://localhost:7000'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      },
    },
  }),
);

// ✅ Remove X-Frame-Options and CSP headers
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  next();
});

app.disable('x-powered-by');

if (process.env.NODE_ENV === 'development') {
  const morgan = await import('morgan');
  app.use(morgan.default('dev'));
}

app.use('/public/image', express.static(path.join(__dirname, 'public/images')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('trust proxy', true);
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.166.80:3001',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// ✅ Static serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/backups', express.static(path.join(process.cwd(), 'backups')));

// ===== Routes =====
import adminRouter from './src/admin/admin-routes.js';
import companyRouter from './src/system-settings/company/company-routes.js';
import dashboardRouter from './src/dashboard/dashboard-routes.js';
import reportsRouter from './src/reports/reports-routes.js';
import hashRouter from './src/admin/hash.routes.js';
import examManagemantRouter from './src/exam-management/exam-management-routes.js';
import markSchemeRouter from './src/mark-scheme/mark-scheme-routes.js';
import settingRoutes from './src/setting/settingRoutes.js';
import subjectRoutes from './src/Subject/subjectRoutes.js';
import StudentRoutes from './src/students/studentRoutes.js';
import Sheetupload from './src/sheetupload/sheetRoutes.js';
import assignmentRoutes from './src/assignment/assignmentRoutes.js';
import workQueueRoutes from './src/work-queue/workRoutes.js';
import recheckRoutes from './src/recheck-queue/recheckRoute.js';
import MarkscheckerRoutes from './src/checker-marking-controller/checkerMarkingRoutes.js';

app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/auth', adminRouter);
app.use('/api/v1/hash', hashRouter);
app.use('/api/v1/setting', settingRoutes);
app.use('/api/v1/auth', subjectRoutes);
app.use('/api/v1/company', companyRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/exam', examManagemantRouter);
app.use('/api/v1/mark-scheme', markSchemeRouter);
app.use('/api/v1/work-queue', workQueueRoutes);
app.use('/api/v1/Students', StudentRoutes);
app.use('/api/v1/sheets', Sheetupload);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/recheck-queue', recheckRoutes);
app.use('/api/v1/checker', MarkscheckerRoutes);

// ===== Root Routes =====
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/developer', (req, res) => {
  res.send(
    `<h1>It is great to see you on the server of <a href="https://www.linkedin.com/in/nitin-gupta-b7a9a02a1/">AASIB KHAN</a></h1>`,
  );
});

// ===== Start Server =====
const port = process.env.PORT || 7000;
app.listen(port, '127.0.0.1', () => {
  console.log({ message: `App is running on port ${port}` });
});
