import type { ResourceReference } from '@dashboard/core';

export type ActivityLockRef = ResourceReference;

export type ActivityChannelMessage =
  | { type: 'renewed'; expiresAt: string }
  | { type: 'expired' };
