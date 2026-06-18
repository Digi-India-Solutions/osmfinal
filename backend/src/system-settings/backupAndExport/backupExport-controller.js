import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import connectDB from '../../pool.js';
import { success, error } from '../../../utils/respons.js';

const execAsync = promisify(exec);

const VALID_EXPORT_TYPES = [
  'items',
  'parties',
  'sales',
  'purchases',
  'stock',
  'audit',
];

const getUserAccess = async (userId) => {
  const additionalRes = await connectDB.query(
    `SELECT additional_controls
     FROM user_permissions 
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  const roleRes = await connectDB.query(
    `SELECT role FROM users WHERE id = $1`,
    [userId],
  );

  return {
    role: roleRes.rows[0]?.role,
    additional_controls: additionalRes.rows[0]?.additional_controls || {},
  };
};

export const triggerBackup = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.user.id;
    if (!user) {
      return res
        .status(401)
        .json(error('UNAUTHORIZED', 'Authentication required'));
    }

    const { role, additional_controls } = await getUserAccess(userId);

    const canTakeBackup = role == 'SUPER_ADMIN';

    if (!canTakeBackup) {
      return res
        .status(403)
        .json(error('FORBIDDEN', 'You are not allowed to export data'));
    }

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 2. Build filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invenpro-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    // 3. Get all table names from PostgreSQL
    const tablesResult = await connectDB.query(
      `SELECT tablename 
       FROM pg_tables 
       WHERE schemaname = 'public'
       ORDER BY tablename ASC`,
    );

    const tables = tablesResult.rows.map((r) => r.tablename);

    if (tables.length === 0) {
      return res
        .status(500)
        .json(error('BACKUP_FAILED', 'No tables found in database'));
    }

    // 4. Export all tables into one JSON object
    const backupData = {
      backup_info: {
        created_at: new Date().toISOString(),
        database: process.env.DB_NAME || 'IMSDATABASE',
        table_count: tables.length,
        tables: tables,
      },
      data: {},
    };

    for (const table of tables) {
      const result = await connectDB.query(`SELECT * FROM "${table}"`);
      backupData.data[table] = result.rows;
    }

    // 5. Write backup file
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');

    // 6. Verify file was created
    if (!fs.existsSync(filepath)) {
      return res
        .status(500)
        .json(error('BACKUP_FAILED', 'Backup file was not created'));
    }

    const fileSize = fs.statSync(filepath).size;
    const baseUrl = process.env.BASE_URL || 'http://localhost:7000';
    const downloadUrl = `${baseUrl}/backups/${filename}`;

    // 7. Audit log
    //     await connectDB.query(
    //         `INSERT INTO audit_logs (user_id, action, entity, entity_id, meta, created_at)
    //    VALUES ($1, $2, $3, $4, $5, NOW())`,
    //         [
    //             req.user?.id || null,
    //             'BACKUP_CREATED',
    //             'system',
    //             null,
    //             JSON.stringify({ filename, size_bytes: fileSize, tables_backed_up: tables.length }),
    //         ],
    //     );

    await connectDB.query(
      `INSERT INTO backups 
   (company_id, filename, size_bytes, tables_count, created_by, created_at)
   VALUES ($1, $2, $3, $4, $5, NOW())`,
      [user.company_id, filename, fileSize, tables.length, userId],
    );

    return res.status(200).json(
      success(
        {
          filename,
          downloadUrl,
          size_bytes: fileSize,
          tables_backed_up: tables.length,
          createdAt: new Date().toISOString(),
        },
        `Backup created successfully — ${tables.length} tables exported`,
      ),
    );
  } catch (err) {
    next(err);
  }
};

export const exportData = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.user.id;
    if (!user) {
      return res
        .status(401)
        .json(error('UNAUTHORIZED', 'Authentication required'));
    }

    const { role, additional_controls } = await getUserAccess(userId);

    const canExport =
      additional_controls?.exportData === true || role == 'SUPER_ADMIN';

    if (!canExport) {
      return res
        .status(403)
        .json(error('FORBIDDEN', 'You are not allowed to export data'));
    }
    const { type } = req.params;

    if (!VALID_EXPORT_TYPES.includes(type)) {
      return res
        .status(400)
        .json(
          error(
            'INVALID_EXPORT_TYPE',
            `Valid types: ${VALID_EXPORT_TYPES.join(', ')}`,
          ),
        );
    }

    let data = [];
    let filename = '';
    //   i.tax_rate,
    switch (type) {
      // ── "Export Items Master" button ────────────────────────────────────────
      case 'items': {
        const result = await connectDB.query(
          `SELECT
             i.id, i.name, i.code, i.barcode, i.hsn_code,
              i.purchase_rate, i.sale_rate, i.mrp,
             i.min_stock_level, i.brand, i.article_no,
             i.is_active, i.created_at,
             c.name       AS category_name,
             u.name       AS unit_name,
             u.short_name AS unit_short
           FROM items i
           LEFT JOIN categories c ON c.id = i.category_id
           LEFT JOIN units      u ON u.id = i.primary_unit_id
           WHERE i.is_active = true
           ORDER BY i.name ASC`,
        );
        data = result.rows;
        filename = 'items-master';
        break;
      }

      // ── "Export Parties" button ─────────────────────────────────────────────
      case 'parties': {
        const result = await connectDB.query(
          `SELECT
             id, name, type, gstin, pan,
             billing_address, state_code, state_name,
             credit_limit, credit_days,
             phone, email, is_active, created_at
           FROM parties
           WHERE is_active = true
           ORDER BY name ASC`,
        );
        data = result.rows;
        filename = 'parties-master';
        break;
      }

      // ── "Export Sales Register" button ──────────────────────────────────────
      case 'sales': {
        const result = await connectDB.query(
          `SELECT
                si.id,
                si.invoice_number,
                si.invoice_date,

                si.total_amount,
                si.paid_amount,
                si.balance_due,
                si.payment_status,
                si.payment_mode,
                si.status,

                si.created_at,

                p.name  AS customer_name,
                p.gstin AS customer_gstin,

                w.name  AS warehouse_name,

                -- ✅ Aggregated tax fields
                COALESCE(SUM(sii.taxable_amount), 0) AS taxable_amount,
                COALESCE(SUM(sii.cgst), 0) AS cgst,
                COALESCE(SUM(sii.sgst), 0) AS sgst,
                COALESCE(SUM(sii.igst), 0) AS igst,
                COALESCE(SUM(sii.total), 0) AS items_total,
                COALESCE(SUM(sii.quantity), 0) AS total_quantity,
                COUNT(sii.id) AS total_items


                FROM sales_invoices si

                LEFT JOIN sales_invoice_items sii 
                ON sii.sales_invoice_id = si.id

                LEFT JOIN parties p 
                ON p.id = si.customer_id

                LEFT JOIN warehouses w 
                ON w.id = si.warehouse_id

                WHERE si.is_active = true

                GROUP BY
                si.id,
                si.invoice_number,
                si.invoice_date,
                si.total_amount,
                si.paid_amount,
                si.balance_due,
                si.payment_status,
                si.payment_mode,
                si.status,
                si.created_at,
                p.name,
                p.gstin,
                w.name

                ORDER BY si.invoice_date DESC`,
        );
        data = result.rows;
        filename = 'sales-register';
        break;
      }

      // ── "Export Purchase Register" button ───────────────────────────────────
      case 'purchases': {
        const result = await connectDB.query(
          `SELECT
                    pi.invoice_number,
                    pi.invoice_date,

                    p.name AS supplier_name,

                    pii.item_name,
                    pii.qty,
                    pii.rate,
                    pii.taxable_amount,
                    pii.cgst_amt,
                    pii.sgst_amt,
                    pii.igst_amt,
                    pii.total_amount

                    FROM purchase_invoices pi
                    JOIN purchase_invoice_items pii ON pii.invoice_id = pi.id
                    LEFT JOIN parties p ON p.id = pi.supplier_id

                    ORDER BY pi.invoice_date DESC;
                    `,
        );
        data = result.rows;
        filename = 'purchase-register';
        break;
      }

      // ── "Export Stock Summary" button ───────────────────────────────────────
      case 'stock': {
        const result = await connectDB.query(
          `SELECT
             ws.id, ws.quantity, ws.updated_at,
             i.name     AS item_name,
             i.code     AS item_code,
             i.hsn_code AS item_hsn,
             w.name     AS warehouse_name
           FROM warehouse_stock ws
           LEFT JOIN items      i ON i.id = ws.item_id
           LEFT JOIN warehouses w ON w.id = ws.warehouse_id
           ORDER BY w.name ASC, i.name ASC`,
        );
        data = result.rows;
        filename = 'stock-summary';
        break;
      }

      // ── "Export Audit Log" button ───────────────────────────────────────────
      //     case 'audit': {
      //         const result = await connectDB.query(
      //             `SELECT
      //      al.id, al.action, al.entity, al.entity_id,
      //      al.meta, al.created_at,
      //      u.name  AS user_name,
      //      u.email AS user_email
      //    FROM audit_logs al
      //    LEFT JOIN users u ON u.id = al.user_id
      //    ORDER BY al.created_at DESC
      //    LIMIT 10000`,
      //         );
      //         data = result.rows;
      //         filename = 'audit-log';
      //         break;
      //     }
    }

    // Set download headers — frontend (SheetJS) converts JSON → Excel
    const dateStr = new Date().toISOString().slice(0, 10);
    const jsonFilename = `invenpro-${filename}-${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${jsonFilename}"`,
    );

    return res
      .status(200)
      .json(success(data, `${data.length} records exported successfully`));
  } catch (err) {
    next(err);
  }
};

export const getBackups = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user)
      return res
        .status(401)
        .json(error('UNAUTHORIZED', 'Authentication required'));

    const { role } = await getUserAccess(user.id);
    if (role !== 'SUPER_ADMIN') {
      return res.status(403).json(error('FORBIDDEN', 'Not allowed'));
    }

    const result = await connectDB.query(
      `SELECT b.id, b.filename, b.size_bytes, b.tables_count, b.created_at,
          u.name AS created_by_name
   FROM backups b
   LEFT JOIN users u ON u.id = b.created_by
   WHERE b.company_id = $1
   ORDER BY b.created_at DESC
   LIMIT 20`,
      [user.company_id],
    );

    return res.status(200).json(success(result.rows, 'Backups fetched'));
  } catch (err) {
    next(err);
  }
};

export const restoreBackup = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user)
      return res
        .status(401)
        .json(error('UNAUTHORIZED', 'Authentication required'));

    const { role } = await getUserAccess(user.id);
    if (role !== 'SUPER_ADMIN') {
      return res
        .status(403)
        .json(error('FORBIDDEN', 'Only Super Admins can restore backups'));
    }

    const { filename } = req.body;
    if (!filename)
      return res
        .status(400)
        .json(error('MISSING_FILENAME', 'filename is required'));

    // Security: prevent path traversal
    const safeFilename = path.basename(filename);
    const filepath = path.join(process.cwd(), 'backups', safeFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json(error('NOT_FOUND', 'Backup file not found'));
    }

    const raw = fs.readFileSync(filepath, 'utf8');
    const backupData = JSON.parse(raw);
    const tableData = backupData.data ?? {};

    // TABLE_ORDER defines FK-safe insert sequence
    const TABLE_ORDER = [
      'companies',
      'roles',
      'units',
      'categories',
      'warehouses',
      'parties',
      'items',
      'document_sequences',
      'po_sequences',
      'barcode_settings',
      'users',
      'user_permissions',
      'user_warehouses',
      'purchase_orders',
      'purchase_order_items',
      'grns',
      'grn_items',
      'purchase_invoices',
      'purchase_invoice_items',
      'purchase_payments',
      'purchase_returns',
      'purchase_return_items',
      'challans',
      'challan_items',
      'sales_invoices',
      'sales_invoice_items',
      'sales_payments',
      'sale_returns',
      'sale_return_items',
      'refunds_given',
      'customer_credits',
      'gate_passes',
      'gate_pass_items',
      'direct_stock_entries',
      'direct_stock_entry_items',
      'stock_adjustments',
      'stock_transfers',
      'stock_transfer_items',
      'stock_movements',
      'warehouse_stock',
      'backups',
    ];

    const client = await connectDB.connect(); // get a client for transaction
    const summary = {};

    try {
      await client.query('BEGIN');

      // ✅ ADD HERE
      const genColsRes = await client.query(`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND is_generated = 'ALWAYS'
            `);

      // Build a Set of "table.column" strings for O(1) lookup
      const generatedCols = new Set(
        genColsRes.rows.map((r) => `${r.table_name}.${r.column_name}`),
      );

      for (const tableName of TABLE_ORDER) {
        if (tableName === 'backups') {
          summary[tableName] = 0;
          continue;
        }

        const rows = tableData[tableName];
        if (!rows || rows.length === 0) {
          summary[tableName] = 0;
          continue;
        }

        const allColumns = Object.keys(rows[0]);

        // ✅ FILTER HERE
        const columns = allColumns.filter(
          (c) => !generatedCols.has(`${tableName}.${c}`),
        );
        const colList = columns.map((c) => `"${c}"`).join(', ');

        let inserted = 0;
        for (const row of rows) {
          const values = columns.map((c) => row[c]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values,
          );
          inserted++;
        }
        summary[tableName] = inserted;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err; // bubble up to next(err)
    } finally {
      client.release();
    }

    const totalRows = Object.values(summary).reduce((a, b) => a + b, 0);
    return res
      .status(200)
      .json(
        success(
          { total_rows_restored: totalRows, tables: summary },
          'Backup restored successfully',
        ),
      );
  } catch (err) {
    next(err);
  }
};
