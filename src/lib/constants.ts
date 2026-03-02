import type { Department, ElectronicOperator } from "@prisma/client";

export const DEPARTMENT_LABELS: Record<string, string> = {
  RECEPTION_BOWLING: "Reception-Bowling",
  PAIDOTOPOS: "Παιδότοπος",
  BILIARDA: "Μπιλιάρδα",
  ELECTRONIC_GAMES: "Ηλεκτρονικά Παιχνίδια",
  BAR: "Bar",
  SERVICE: "Service",
  PROSHOP: "ProShop",
};

export const OPERATOR_LABELS: Record<ElectronicOperator, string> = {
  ADAM_GAMES: "Adam Games",
  TWOPLAY_GAMES: "2play Games",
  DIKA_MOU: "Δικά μου ηλεκτρονικά",
};

export const BOWLING_SUBLABELS = ["Regular", "Tournament", "League", "Εκδήλωση"] as const;

export const ELECTRONIC_OPERATORS: ElectronicOperator[] = [
  "ADAM_GAMES",
  "TWOPLAY_GAMES",
  "DIKA_MOU",
];
