import pkg from "pg";
const { Pool } = pkg;

export const connectDB = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  port: process.env.DB_PORT || 5432,
  password: process.env.DB_PASSWORD || '1234567123',
  database: process.env.DB_NAME || 'Exam-Management',
});

connectDB.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch((err) => console.error("❌ Connection Error:", err));

export default connectDB;
