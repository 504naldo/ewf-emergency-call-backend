import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

/**
 * Update technician passwords to use bcrypt hashing
 * 
 * Usage: npx tsx server/scripts/update-passwords.ts
 */

const technicians = [
  "tony@ewandf.ca",
  "chris@ewandf.ca",
  "ranaldo@ewandf.ca",
  "markus@ewandf.ca",
  "pat@ewandf.ca",
  "russ@ewandf.ca",
  "craig@ewandf.ca",
];

async function updatePasswords() {
  const db = await getDb();
  
  if (!db) {
    console.error("❌ Failed to connect to database");
    process.exit(1);
  }
  
  console.log("🔐 Updating technician passwords to bcrypt...\n");
  
  const defaultPassword = "ewf2024!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  
  for (const email of technicians) {
    try {
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email));
      
      console.log(`✅ Updated password for: ${email}`);
    } catch (error) {
      console.error(`❌ Error updating ${email}:`, error);
    }
  }
  
  console.log(`\n✨ Password update complete!`);
  console.log(`📝 Default password: ${defaultPassword}\n`);
  
  process.exit(0);
}

updatePasswords().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
