-- Dynamic electronic operators: replace enum + config with table (add/remove providers)
PRAGMA foreign_keys=OFF;

-- New table: operators identified by id
CREATE TABLE "ElectronicOperator" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1
);

-- Seed default operators (fixed ids for migration mapping)
INSERT INTO "ElectronicOperator" ("id", "name", "active") VALUES
  ('op-adam', 'Adam Games', 1),
  ('op-twoplay', '2play Games', 1),
  ('op-dika', 'Δικά μου ηλεκτρονικά', 1);

-- RevenueLine: replace operator (enum) with operatorId (FK to ElectronicOperator)
CREATE TABLE "new_RevenueLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dayId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "subLabel" TEXT,
  "subLabelInfo" TEXT,
  "staffId" TEXT,
  "operatorId" TEXT,
  "total" REAL NOT NULL,
  "cash" REAL NOT NULL,
  CONSTRAINT "new_RevenueLine_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "new_RevenueLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "new_RevenueLine_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "ElectronicOperator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_RevenueLine" ("id", "dayId", "department", "subLabel", "subLabelInfo", "staffId", "operatorId", "total", "cash")
SELECT
  "id", "dayId", "department", "subLabel", "subLabelInfo", "staffId",
  CASE "operator"
    WHEN 'ADAM_GAMES' THEN 'op-adam'
    WHEN 'TWOPLAY_GAMES' THEN 'op-twoplay'
    WHEN 'DIKA_MOU' THEN 'op-dika'
    ELSE NULL
  END,
  "total", "cash"
FROM "RevenueLine";

DROP TABLE "RevenueLine";
ALTER TABLE "new_RevenueLine" RENAME TO "RevenueLine";

-- Remove old config table
DROP TABLE "ElectronicOperatorConfig";

PRAGMA foreign_keys=ON;
