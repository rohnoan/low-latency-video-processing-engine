import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: "testuser1@test.com",
    },
  });

  console.log("USER CREATED:");
  console.log(user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
