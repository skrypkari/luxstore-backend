
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { slug_without_id: true },
    where: { slug_without_id: { not: null } },
  });

  const links = products
    .map((p) =>
      p.slug_without_id
        ? `https://lux-store.eu/products/${p.slug_without_id}`
        : null
    )
    .filter(Boolean)
    .join("\n");

  fs.writeFileSync("./urls.txt", links, "utf8");
  console.log("Links file generated: ./urls.txt");
}

main().finally(() => prisma.$disconnect());
