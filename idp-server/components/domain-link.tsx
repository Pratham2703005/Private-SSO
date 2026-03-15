'use client';

import { openDomainLink } from '@/lib/url-utils';

interface DomainLinkProps {
  domain: string;
  isConnected: boolean;
  displayText?: string;
}

/**
 * Pure component for rendering a domain link
 * Opens the domain in a new window when clicked
 */
export function DomainLink({
  domain,
  isConnected,
  displayText,
}: DomainLinkProps) {
  if (!isConnected) {
    return <span className="value">{displayText || domain}</span>;
  }

  return (
    <a
      onClick={() => openDomainLink(domain)}
      className="value"
      style={{ cursor: 'pointer' }}
    >
      {displayText || domain}
    </a>
  );
}
