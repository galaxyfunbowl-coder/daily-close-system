-- CreateTable
CREATE TABLE "MyDataExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mark" TEXT NOT NULL,
    "uid" TEXT,
    "issuerVat" TEXT,
    "issuerName" TEXT,
    "receiverVat" TEXT,
    "issueDate" DATETIME,
    "invoiceType" TEXT,
    "series" TEXT,
    "aa" TEXT,
    "netAmount" REAL,
    "vatAmount" REAL,
    "totalAmount" REAL,
    "currency" TEXT,
    "cancellationMark" TEXT,
    "isCancelled" INTEGER NOT NULL DEFAULT 0,
    "sourceRaw" TEXT,
    "attachmentPath" TEXT,
    "attachmentOriginalName" TEXT,
    "attachmentMime" TEXT,
    "attachmentUploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MyDataExpense_mark_key" ON "MyDataExpense"("mark");

-- AlterTable Expense: add myDATA fields
ALTER TABLE "Expense" ADD COLUMN "source" TEXT;
ALTER TABLE "Expense" ADD COLUMN "userEdited" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "myDataExpenseId" TEXT;

-- AlterTable Supplier: add vatNumber
ALTER TABLE "Supplier" ADD COLUMN "vatNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_myDataExpenseId_key" ON "Expense"("myDataExpenseId");
