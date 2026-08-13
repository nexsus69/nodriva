'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useNavigationConfirmation } from '../../navigation/NavigationBlocker';

type GuardedLinkProps = ComponentProps<typeof NextLink>;

export default function GuardedLink({ onNavigate, ...props }: GuardedLinkProps) {
  const confirmNavigation = useNavigationConfirmation();
  return (
    <NextLink
      {...props}
      onNavigate={(event) => {
        if (!confirmNavigation()) {
          event.preventDefault();
          return;
        }
        onNavigate?.(event);
      }}
    />
  );
}
