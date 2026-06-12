-- Add username as nullable first to handle existing rows
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Set username for existing rows
UPDATE "User" SET "username" = split_part(email, '@', 1) WHERE "username" IS NULL;

-- Make username NOT NULL and add unique constraint
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Add mustChangePassword with default true
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- Make email nullable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
