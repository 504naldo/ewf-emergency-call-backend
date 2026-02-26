import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

/**
 * Seed script to create real technician users for EWF Emergency Call Service
 * 
 * Usage: npx tsx server/scripts/seed-technicians.ts
 */

// Hash password using bcrypt (same as auth.ts)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

const technicians = [
  { email: "tony@ewandf.ca", name: "Tony" },
  { email: "chris@ewandf.ca", name: "Chris" },
  { email: "ranaldo@ewandf.ca", name: "Ranaldo" },
  { email: "markus@ewandf.ca", name: "Markus" },
  { email: "pat@ewandf.ca", name: "Pat" },
  { email: "russ@ewandf.ca", name: "Russ" },
  { email: "craig@ewandf.ca", name: "Craig" },
];

async function seedTechnicians() {
  const db = await getDb();
  
  if (!db) {
    console.error("❌ Failed to connect to database");
    process.exit(1);
  }
  
  console.log("🌱 Seeding technician users...\n");
  
  // Default password for all technicians (should be changed after first login)
  const defaultPassword = "ewf2024!";
  const hashedPassword = await hashPassword(defaultPassword);
  
  for (const tech of technicians) {
    try {
      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.email, tech.email)).limit(1);
      
      if (existing.length > 0) {
        console.log(`⏭️  ${tech.email} already exists, skipping...`);
        continue;
      }
      
      // Create new technician user
      await db.insert(users).values({
        openId: `email:${tech.email}`,
        name: tech.name,
        email: tech.email,
        password: hashedPassword,
        phone: null, // Will be added later
        loginMethod: "email",
        role: "tech",
        active: true,
        available: true,
      });
      
      console.log(`✅ Created technician: ${tech.name} (${tech.email})`);
    } catch (error) {
      console.error(`❌ Error creating ${tech.email}:`, error);
    }
  }
  
  // Promote Ranaldo to admin role
  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, "ranaldo@ewandf.ca"));
  console.log("\n🔑 Promoted ranaldo@ewandf.ca to admin role");
  
  console.log(`\n✨ Seeding complete!`);
  console.log(`\n📝 Default password for all technicians: ${defaultPassword}`);
  console.log(`⚠️  Users should change their password after first login\n`);
  
  process.exit(0);
}

seedTechnicians().catch((error) => {
  console.error("Fatal error during seeding:", error);
  process.exit(1);
});
