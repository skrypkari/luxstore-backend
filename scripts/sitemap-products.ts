import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { slug_with_id: true },
    where: { slug_with_id: { not: null } },
  });

  const urls = products
    .map((p) =>
      p.slug_with_id
        ? `  <url>\n    <loc>https://lux-store.eu/products/${p.slug_with_id}</loc>\n    <priority>0.9</priority>\n  </url>`
        : null
    )
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  fs.writeFileSync("../../frontend/public/sitemap-products.xml", xml, "utf8");
  console.log("Sitemap generated: frontend/public/sitemap-products.xml");
}

main().finally(() => prisma.$disconnect());
