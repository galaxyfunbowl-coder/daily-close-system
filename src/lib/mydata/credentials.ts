/**
 * Resolve myDATA credentials: env vars override CompanySettings.
 * Never log subscription key.
 */

import { prisma } from "@/lib/db";

export type MyDataCredentials = {
  userId: string;
  subscriptionKey: string;
};

export async function getMyDataCredentials(): Promise<MyDataCredentials | null> {
  const fromEnv =
    process.env.MYDATA_USER_ID && process.env.MYDATA_SUBSCRIPTION_KEY
      ? {
          userId: process.env.MYDATA_USER_ID,
          subscriptionKey: process.env.MYDATA_SUBSCRIPTION_KEY,
        }
      : null;

  if (fromEnv) return fromEnv;

  const settings = await prisma.companySettings.findUnique({
    where: { id: "main" },
    select: { mydataUserId: true, mydataSubscriptionKey: true },
  });

  if (
    settings?.mydataUserId &&
    settings?.mydataSubscriptionKey
  ) {
    return {
      userId: settings.mydataUserId,
      subscriptionKey: settings.mydataSubscriptionKey,
    };
  }

  return null;
}
