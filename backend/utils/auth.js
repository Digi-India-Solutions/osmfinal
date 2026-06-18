import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


// 🔐 Hash Password
export const hashPassword = async (password) => {
  try {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    throw new Error("Error hashing password");
  }
};


// 🔍 Compare Password
export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error("Error comparing password");
  }
};


// 🎟️ Generate Access Token
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      company_id: user.company_id
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d",
    }
  );
};


// 🔄 Generate Refresh Token
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
    
      id: user.id,
      email: user.email,
      company_id: user.company_id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    }
  );
};

