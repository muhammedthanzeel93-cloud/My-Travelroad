import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting idempotent database seed...");

  // 1. Provision Root System Account (if not already seeded by migration)
  const SYSTEM_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
  const SYSTEM_EMAIL = "system-internal@mytravelroad.local";

  const existingSystemAccount = await prisma.account.findUnique({
    where: { id: SYSTEM_ACCOUNT_ID },
  });

  if (!existingSystemAccount) {
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
  } else {
    console.log(`Root system account verified: ${SYSTEM_ACCOUNT_ID}`);
  }

  // Invariant validation: Ensure root system account has zero credentials, profiles, or saved destinations
  const credentialCheck = await prisma.accountSecurityCredential.findUnique({
    where: { accountId: SYSTEM_ACCOUNT_ID },
  });
  if (credentialCheck) {
    throw new Error("SECURITY INVARIANT VIOLATION: Root system account has security credentials!");
  }

  const profileCheck = await prisma.touristProfile.findUnique({
    where: { accountId: SYSTEM_ACCOUNT_ID },
  });
  if (profileCheck) {
    throw new Error("SECURITY INVARIANT VIOLATION: Root system account has a tourist profile!");
  }

  // 2. Provision Initial Malappuram Destination Categories
  const initialCategories = [
    {
      slug: "nature-wildlife",
      name: "Nature & Wildlife",
      description:
        "Forests, rivers, bird sanctuaries, ecotourism destinations, and protected wildlife reserves.",
      displayOrder: 10,
      iconName: "trees",
    },
    {
      slug: "beaches-coastal",
      name: "Beaches & Estuaries",
      description:
        "Coastal attractions, serene estuaries, river mouths, and tranquil beaches along the Arabian Sea.",
      displayOrder: 20,
      iconName: "waves",
    },
    {
      slug: "hills-valleys",
      name: "Waterfalls & Hills",
      description:
        "Misty hillocks, verdant viewpoints, seasonal cascading waterfalls, and trekking pathways.",
      displayOrder: 30,
      iconName: "mountain",
    },
    {
      slug: "heritage-culture",
      name: "Heritage & Culture",
      description:
        "Centuries-old temples, mosques, teak museums, historical architecture, and cultural landmarks.",
      displayOrder: 40,
      iconName: "landmark",
    },
  ];

  for (const cat of initialCategories) {
    const category = await prisma.destinationCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
        iconName: cat.iconName,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
        iconName: cat.iconName,
      },
    });
    console.log(`Seeded destination category: ${category.name} (${category.slug}) [${category.id}]`);
  }

  console.log("Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during database seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
