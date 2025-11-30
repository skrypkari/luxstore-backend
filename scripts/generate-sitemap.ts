import * as fs from 'fs';
import * as path from 'path';

const URLS_FILE = path.join(__dirname, 'urls.txt');
const OUTPUT_FILE = path.join(__dirname, 'sitemap.ts');

// Static pages that should always be included
const staticPages = [
  {
    url: "https://lux-store.eu/",
    priority: 1.0
  },
  {
    url: "https://lux-store.eu/about",
    priority: 0.8
  },
  {
    url: "https://lux-store.eu/contact",
    priority: 0.8
  },
  {
    url: "https://lux-store.eu/cookies",
    priority: 0.3
  },
  {
    url: "https://lux-store.eu/privacy",
    priority: 0.3
  },
  {
    url: "https://lux-store.eu/terms",
    priority: 0.3
  },
  {
    url: "https://lux-store.eu/returns",
    priority: 0.5
  },
  {
    url: "https://lux-store.eu/store/all",
    priority: 0.9
  },
  {
    url: "https://lux-store.eu/store/bags",
    priority: 0.9
  },
  {
    url: "https://lux-store.eu/store/watches",
    priority: 0.9
  },
  {
    url: "https://lux-store.eu/store/jewelry",
    priority: 0.9
  },
  {
    url: "https://lux-store.eu/store/sunglasses",
    priority: 0.9
  }
];

function generateSitemap() {
  console.log('📖 Reading URLs from file...');
  
  // Read URLs from file
  const urlsContent = fs.readFileSync(URLS_FILE, 'utf-8');
  const productUrls = urlsContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('https://'));

  console.log(`✅ Found ${productUrls.length} product URLs`);

  // Remove duplicates by converting to Set and back to array
  const uniqueUrls = [...new Set(productUrls)];
  console.log(`🔍 Unique URLs: ${uniqueUrls.length}`);

  // Create sitemap entries
  const sitemapEntries: string[] = [];

  // Add static pages first
  staticPages.forEach(page => {
    sitemapEntries.push(`    {
      url: "${page.url}",
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: ${page.priority}
    }`);
  });

  // Add product URLs (priority 0.9 for all products)
  uniqueUrls.forEach(url => {
    sitemapEntries.push(`    {
      url: "${url}",
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9
    }`);
  });

  // Generate TypeScript sitemap file
  const sitemapContent = `import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
${sitemapEntries.join(',\n')}
  ];
}
`;

  // Write to output file
  fs.writeFileSync(OUTPUT_FILE, sitemapContent, 'utf-8');

  console.log(`📝 Sitemap generated successfully!`);
  console.log(`📍 Output file: ${OUTPUT_FILE}`);
  console.log(`📊 Total entries: ${sitemapEntries.length} (${staticPages.length} static + ${uniqueUrls.length} products)`);
}

// Run the generator
try {
  generateSitemap();
  console.log('✨ Done!');
} catch (error) {
  console.error('❌ Error generating sitemap:', error);
  process.exit(1);
}

