-- CreateTable
CREATE TABLE "FixedMonthlyExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL
);
