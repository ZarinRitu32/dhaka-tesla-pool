const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Seed data uses the brief's own cast throughout (Section 18) instead of
// generic user1/driver1 placeholders — same names appear in the README demo
// credentials and in the Postman/Swagger examples.
async function main() {
  const password = await bcrypt.hash("password123", 10);

  const jashim = await prisma.user.upsert({
    where: { email: "jashim@teslapool.dev" },
    update: {},
    create: { name: "Jashim", email: "jashim@teslapool.dev", passwordHash: password, role: "DRIVER" },
  });

  const nusrat = await prisma.user.upsert({
    where: { email: "nusrat@teslapool.dev" },
    update: {},
    create: { name: "Nusrat", email: "nusrat@teslapool.dev", passwordHash: password, role: "PASSENGER" },
  });

  const rafiq = await prisma.user.upsert({
    where: { email: "rafiq@teslapool.dev" },
    update: {},
    create: { name: "Rafiq", email: "rafiq@teslapool.dev", passwordHash: password, role: "PASSENGER" },
  });

  const shirin = await prisma.user.upsert({
    where: { email: "shirin@teslapool.dev" },
    update: {},
    create: { name: "Shirin", email: "shirin@teslapool.dev", passwordHash: password, role: "PASSENGER" },
  });

  const existingBullet = await prisma.tesla.findFirst({ where: { name: "Bullet", driverId: jashim.id } });
  const bullet =
    existingBullet ||
    (await prisma.tesla.create({
      data: { driverId: jashim.id, name: "Bullet", capacity: 3, isOnline: true },
    }));

  console.log("Seeded:", { jashim: jashim.email, nusrat: nusrat.email, rafiq: rafiq.email, shirin: shirin.email, bullet: bullet.id });
  console.log("All demo passwords: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
