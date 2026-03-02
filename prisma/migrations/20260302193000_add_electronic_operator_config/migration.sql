-- Table for configurable electronic game operators (labels + active flag)
CREATE TABLE "ElectronicOperatorConfig" (
  "operator" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1
);

