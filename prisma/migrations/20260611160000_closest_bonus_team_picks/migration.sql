-- AlterTable: add closestBonus to Prediction
ALTER TABLE "Prediction" ADD COLUMN "closestBonus" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: replace teamId (single) with teamIds (array) in TeamPickEntry
ALTER TABLE "TeamPickEntry" ADD COLUMN "teamIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "TeamPickEntry" SET "teamIds" = ARRAY["teamId"] WHERE "teamId" IS NOT NULL AND "teamId" != '';
ALTER TABLE "TeamPickEntry" DROP COLUMN "teamId";
