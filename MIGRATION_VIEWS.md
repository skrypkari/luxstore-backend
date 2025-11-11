# Views Field Migration

## Overview
This migration adds a `views` field to the Product model to track how many times each product page has been viewed.

## Changes Made

### 1. Database Schema
- Added `views` field to `Product` model in `prisma/schema.prisma`
- Type: `Int` with default value of `0`
- Position: After `slug_without_id` field

### 2. Backend Logic
- Updated `getProductById` method in `products.service.ts`
- Increments views count on every product page view
- Returns views in API response

### 3. Frontend Display
- Updated product page (`frontend/app/product/[id]/page.tsx`)
- Displays formatted view count with eye icon
- Shows in SKU & Quick Info section

## Migration Application

### Option 1: Manual Script (Recommended for Production DB)
If you don't have shadow database permissions:

```bash
# 1. Stop the backend server
# 2. Run the migration script
cd backend
node scripts/apply-views-migration.js

# 3. Generate Prisma client
npx prisma generate

# 4. Restart the server
npm run start:dev
```

### Option 2: Prisma Migrate (For Local Development)
If you have full database permissions:

```bash
cd backend
npx prisma migrate dev --name add_views_field
```

## Initial Data
- Existing products will have random view counts between 3,000 and 17,000
- New products will start with 0 views
- Views increment by 1 each time a product page is accessed

## Testing
1. Open any product page
2. Check that views are displayed
3. Refresh the page
4. Views should increment by 1

## Rollback
To remove the views field:

```sql
ALTER TABLE `Product` DROP COLUMN `views`;
```

Then update the Prisma schema and regenerate the client.
