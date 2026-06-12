CREATE TABLE "TeamPickContest" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pts" INTEGER NOT NULL,
  "teamIds" TEXT[],
  "open" BOOLEAN NOT NULL DEFAULT true,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "winnerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamPickContest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamPickEntry" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "points" INTEGER,
  CONSTRAINT "TeamPickEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TeamPickEntry"
  ADD CONSTRAINT "TeamPickEntry_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "TeamPickContest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamPickEntry"
  ADD CONSTRAINT "TeamPickEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TeamPickEntry_contestId_userId_key"
  ON "TeamPickEntry"("contestId", "userId");
