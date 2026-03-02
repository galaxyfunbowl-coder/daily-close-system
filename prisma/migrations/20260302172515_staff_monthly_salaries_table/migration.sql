/*
  Warnings:

  - You are about to drop the column `monthlySalary` on the `Staff` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StaffMonthlySalary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "StaffMonthlySalary_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SERVER',
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Staff" ("active", "id", "name", "role") SELECT "active", "id", "name", "role" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StaffMonthlySalary_staffId_month_key" ON "StaffMonthlySalary"("staffId", "month");
