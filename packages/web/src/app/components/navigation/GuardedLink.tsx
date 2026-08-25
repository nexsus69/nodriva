'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useHrefNavigationRequest } from '../../navigation/NavigationBlocker';

type GuardedLinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & {
  href: string;
};

export default function GuardedLink({ onNavigate, ...props }: GuardedLinkProps) {
  const requestHrefNavigation = useHrefNavigationRequest();
  return (
    <NextLink
      {...props}
      onNavigate={(event) => {
        onNavigate?.(event);
        event.preventDefault();
        void requestHrefNavigation(props.href);
      }}
    />
  );
}
