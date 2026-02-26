import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Test password for all users: "password123"
const TEST_PASSWORD = "password123";

async function addPasswords() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    // Hash the test password
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);
    
    console.log("Hashed password:", hashedPassword);

    // Update all users with the hashed password
    const [result]: any = await conn.execute(
      "UPDATE users SET password = ? WHERE password IS NULL OR password = ''",
      [hashedPassword]
    );

    console.log(`Updated ${result.affectedRows} users with hashed password`);
    console.log(`\nTest credentials:`);
    console.log(`Email: john.smith@ewf.com`);
    console.log(`Password: ${TEST_PASSWORD}`);
  } catch (error) {
    console.error("Error adding passwords:", error);
  } finally {
    await conn.end();
  }
}

addPasswords();
