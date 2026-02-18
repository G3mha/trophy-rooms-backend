import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const platform = await prisma.platform.findFirst({ where: { slug: "pc" } });
  const count = await prisma.game.count({ where: { platformId: platform?.id } });
  console.log("Remaining PC games:", count);
  await prisma.$disconnect();
}
main();
