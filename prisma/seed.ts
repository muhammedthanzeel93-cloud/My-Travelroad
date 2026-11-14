import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting idempotent database seed...");

  const SYSTEM_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
  const SYSTEM_EMAIL = "system-internal@mytravelroad.local";

  // 1. Conflict Pre-Check: Validate reserved Email collision
  const existingByEmail = await prisma.account.findFirst({
    where: {
      email: {
        equals: SYSTEM_EMAIL,
        mode: "insensitive",
      },
    },
  });

  if (existingByEmail && existingByEmail.id !== SYSTEM_ACCOUNT_ID) {
    throw new Error(
      `CRITICAL SEED CONFLICT: Reserved root system email ${SYSTEM_EMAIL} is already occupied by a non-system UUID (${existingByEmail.id}). Manual DBA resolution required.`
    );
  }

  // 2. Validate or Provision Root System Account
  const existingById = await prisma.account.findUnique({
    where: { id: SYSTEM_ACCOUNT_ID },
  });

  if (existingById) {
    // Strict Invariant Check: Every identity and security attribute must match the specification
    const isConflict =
      existingById.email.toLowerCase() !== SYSTEM_EMAIL.toLowerCase() ||
      existingById.type !== "system" ||
      existingById.role !== "super_admin" ||
      existingById.status !== "active" ||
      existingById.phone !== null ||
      existingById.emailVerified !== true ||
      existingById.phoneVerified !== false ||
      existingById.lastLoginAt !== null;

    if (isConflict) {
      throw new Error(
        `CRITICAL SEED CONFLICT: Reserved root system UUID ${SYSTEM_ACCOUNT_ID} is occupied by conflicting attributes (email: ${existingById.email}, type: ${existingById.type}, role: ${existingById.role}, status: ${existingById.status}, phone: ${existingById.phone}, email_verified: ${existingById.emailVerified}, phone_verified: ${existingById.phoneVerified}, last_login_at: ${existingById.lastLoginAt}). Manual DBA resolution required.`
      );
    }
    console.log(`Verified existing root system account: ${SYSTEM_ACCOUNT_ID} (${SYSTEM_EMAIL})`);
  } else {
    await prisma.account.create({
      data: {
        id: SYSTEM_ACCOUNT_ID,
        email: SYSTEM_EMAIL,
        phone: null,
        emailVerified: true,
        phoneVerified: false,
        status: "active",
        type: "system",
        role: "super_admin",
      },
    });
    console.log(`Provisioned root system account: ${SYSTEM_ACCOUNT_ID} (${SYSTEM_EMAIL})`);
  }

  // 3. Invariant Enforcement: Validate Root System Account has NO child records
  const credentialCount = await prisma.accountSecurityCredential.count({
    where: { accountId: SYSTEM_ACCOUNT_ID },
  });
  if (credentialCount > 0) {
    throw new Error("SECURITY INVARIANT VIOLATION: Root system account has security credentials provisioned!");
  }

  const profileCount = await prisma.touristProfile.count({
    where: { accountId: SYSTEM_ACCOUNT_ID },
  });
  if (profileCount > 0) {
    throw new Error("SECURITY INVARIANT VIOLATION: Root system account has a tourist profile provisioned!");
  }

  const savedCount = await prisma.savedDestination.count({
    where: { accountId: SYSTEM_ACCOUNT_ID },
  });
  if (savedCount > 0) {
    throw new Error("SECURITY INVARIANT VIOLATION: Root system account has saved destinations provisioned!");
  }

  console.log("Root system account invariant checks passed (0 credentials, 0 profiles, 0 saved destinations).");

  // 4. Provision Initial Malappuram Destination Categories (Section 3.4)
  const initialCategories = [
    {
      slug: "nature-wildlife",
      name: "Nature & Wildlife",
      shortLabel: "Wildlife",
      description:
        "Forests, rivers, bird sanctuaries, ecotourism destinations, and protected wildlife reserves across Malappuram.",
      iconKey: "trees",
      displayOrder: 10,
      status: "active",
    },
    {
      slug: "beaches-coastal",
      name: "Beaches & Estuaries",
      shortLabel: "Beaches",
      description:
        "Coastal attractions, serene estuaries, river mouths, and tranquil beaches along the Arabian Sea.",
      iconKey: "waves",
      displayOrder: 20,
      status: "active",
    },
    {
      slug: "hills-valleys",
      name: "Waterfalls & Hills",
      shortLabel: "Hills",
      description:
        "Misty hillocks, verdant viewpoints, seasonal cascading waterfalls, and trekking pathways.",
      iconKey: "mountain",
      displayOrder: 30,
      status: "active",
    },
    {
      slug: "heritage-culture",
      name: "Heritage & Culture",
      shortLabel: "Heritage",
      description:
        "Centuries-old temples, mosques, teak museums, historical architecture, and cultural landmarks.",
      iconKey: "landmark",
      displayOrder: 40,
      status: "active",
    },
  ];

  for (const cat of initialCategories) {
    const category = await prisma.destinationCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        shortLabel: cat.shortLabel,
        description: cat.description,
        iconKey: cat.iconKey,
        displayOrder: cat.displayOrder,
        status: cat.status,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        shortLabel: cat.shortLabel,
        description: cat.description,
        iconKey: cat.iconKey,
        displayOrder: cat.displayOrder,
        status: cat.status,
      },
    });
    console.log(`Seeded destination category: ${category.name} (${category.slug}) [${category.id}]`);
  }

  console.log("Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during database seed execution:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
