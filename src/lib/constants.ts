import type { Department } from "@prisma/client";

export const DEPARTMENT_LABELS: Record<string, string> = {
  RECEPTION_BOWLING: "Reception-Bowling",
  PAIDOTOPOS: "Παιδότοπος",
  BILIARDA: "Μπιλιάρδα",
  ELECTRONIC_GAMES: "Ηλεκτρονικά Παιχνίδια",
  BAR: "Bar",
  SERVICE: "Service",
  PROSHOP: "ProShop",
};

export const BOWLING_SUBLABELS = ["Regular", "Tournament", "League", "Εκδήλωση"] as const;
