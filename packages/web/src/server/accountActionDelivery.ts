/** Drains durable account-action messages from either persistence profile. */

export async function drainAccountActionDeliveryOutbox(limit = 25): Promise<number> {
  const { accountActionDeliveryDrainer } = await import('./db');
  return accountActionDeliveryDrainer ? accountActionDeliveryDrainer.drain(limit) : 0;
}
