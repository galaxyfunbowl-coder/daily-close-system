-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyVat" TEXT,
    "mydataUserId" TEXT,
    "mydataSubscriptionKey" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- Insert default row
INSERT INTO "CompanySettings" ("id", "updatedAt") VALUES ('main', datetime('now'));
