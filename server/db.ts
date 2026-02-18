import mysql from "mysql2/promise";

/**
 * Railway provides DATABASE_URL automatically.
 * Example:
 * mysql://user:password@host:port/database
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const db = await mysql.createConnection(process.env.DATABASE_URL);

console.log("[db] Connected to Railway MySQL");
