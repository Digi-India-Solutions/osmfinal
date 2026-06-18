// import jwt from "jsonwebtoken";

// export const verifyToken = (req, res, next) => {
//   try {
//     let token;

//     // ✅ 1. Check Authorization header (MOST IMPORTANT)
//     if (req.headers.authorization?.startsWith("Bearer")) {
//       token = req.headers.authorization.split(" ")[1];
//     }

//     // ✅ 2. Fallback to cookies (optional)
//     if (!token && req.cookies?.token) {
//       token = req.cookies.token;
//     }

//     // ❌ No token
//     if (!token) {
//       return res.status(401).json({
//         message: "Unauthorized you are not logged In",
//       });
//     }

//     // ✅ Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

//     console.log("DECODED USER =>", decoded); // 🔥 DEBUG

//     req.user = decoded;
//    req.company_id = decoded.company_id; // for convenience in controllers
//     next();

//   } catch (err) {
//     console.error("TOKEN ERROR =>", err.message);

//     if (err.name === "JsonWebTokenError") {
//       return res.status(401).json({ message: "Invalid token signature" });
//     } else if (err.name === "TokenExpiredError") {
//       return res.status(401).json({ message: "Token expired" });
//     } else {
//       return res.status(401).json({ message: "Authentication failed" });
//     }
//   }
// };


import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    let token;

    // ✅ 1. Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]?.trim();
    }

    // ✅ 2. Fallback to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token?.trim();
    }

    // ❌ No token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized — no token provided",
      });
    }

    // ✅ Strip surrounding quotes if token was double-stringified
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }

    // ✅ Basic JWT format check before verifying
    if (token.split('.').length !== 3) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // ✅ Verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.user       = decoded;
    req.company_id = decoded.company_id; // convenience

    next();

  } catch (err) {
    console.error("TOKEN ERROR =>", err.name, err.message);

    const messages = {
      JsonWebTokenError: "Invalid token",
      TokenExpiredError: "Token expired — please login again",
      NotBeforeError:    "Token not yet valid",
    };

    return res.status(401).json({
      success: false,
      message: messages[err.name] ?? "Authentication failed",
    });
  }
};