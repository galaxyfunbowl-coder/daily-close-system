-- Drop POS column from RevenueLine; we now only use Z POS totals
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_RevenueLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dayId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "subLabel" TEXT,
  "subLabelInfo" TEXT,
  "staffId" TEXT,
  "operator" TEXT,
  "total" REAL NOT NULL,
  "cash" REAL NOT NULL,
  CONSTRAINT "new_RevenueLine_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "new_RevenueLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_RevenueLine" ("id","dayId","department","subLabel","subLabelInfo","staffId","operator","total","cash")
SELECT "id","dayId","department","subLabel","subLabelInfo","staffId","operator","total","cash"
FROM "RevenueLine";

DROP TABLE "RevenueLine";
ALTER TABLE "new_RevenueLine" RENAME TO "RevenueLine";

PRAGMA foreign_keys=ON;

