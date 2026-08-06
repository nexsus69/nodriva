import { AccountActionPurpose } from './AccountActionTokenPort.js';

export interface AccountActionDeliveryPort {
  deliver(input: { email: string; purpose: AccountActionPurpose; token: string; expiresAt: Date }): Promise<void>;
}
