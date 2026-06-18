import pool from '../pool.js';


const DEFAULT_SETTINGS = {
    size: "75x37",
    customW: 80,
    customH: 40,
    format: "CODE128",
    fields: {
        companyName: true,
        productName: true,
        brand: true,
        category: false,
        mrp: true,
        saleRate: true,
        hsnCode: false,
        articleNo: false,
        barcodeImage: true,
        barcodeNumber: true,
        sizeColor: false,
        customText: false,
    },
    customText: "",
};


export const getLabelSettings = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return next(new ErrorHandler("User not authenticated.", 401));
        }

        const result = await pool.query(
            "SELECT settings FROM label_settings WHERE user_id = $1",
            [String(userId)]
        );

        const settings =
            result.rows.length > 0
                ? { ...DEFAULT_SETTINGS, ...result.rows[0].settings }
                : DEFAULT_SETTINGS;

        res.status(200).json({
            success: true,
            settings,
        });
    } catch (error) {
        console.error("getDashboardSummary error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const saveLabelSettings = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { settings } = req.body;

        if (!userId) {
            return next(new ErrorHandler("User not authenticated.", 401));
        }

        if (!settings || typeof settings !== "object") {
            return next(new ErrorHandler("Invalid settings payload.", 400));
        }

        // Upsert — insert or update if user_id already exists
        await pool.query(
            `INSERT INTO label_settings (user_id, settings)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET settings = $2`,
            [String(userId), JSON.stringify(settings)]
        );

        res.status(200).json({
            success: true,
            message: "Label settings saved successfully.",
        });
    } catch (error) {
        console.error('getSalesTrend error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


