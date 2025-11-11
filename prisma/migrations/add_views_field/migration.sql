-- AlterTable
ALTER TABLE `Product` ADD COLUMN `views` INT NOT NULL DEFAULT 0;

-- Update existing products with random views between 3000 and 17000
UPDATE `Product` SET `views` = FLOOR(3000 + (RAND() * 14000));
