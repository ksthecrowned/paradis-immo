'use client';

import { DashIcon } from '@/components/dash-icon';
import Image from 'next/image';
import { useState } from 'react';

export interface UserIdentityProps {
  name: string | null | undefined;
  avatarUrl?: string | null;
  fallbackName?: string;
}

export function UserIdentity({
  name,
  avatarUrl,
  fallbackName = 'Utilisateur',
}: UserIdentityProps): React.JSX.Element {
  const displayName = name?.trim() || fallbackName;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showAvatar = Boolean(avatarUrl) && failedUrl !== avatarUrl;

  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-normal text-foreground">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/10 text-muted">
        {showAvatar && avatarUrl ? (
          <Image
            src={avatarUrl}
            width={32}
            height={32}
            alt=""
            className="size-full object-cover"
            onError={() => setFailedUrl(avatarUrl)}
          />
        ) : (
          <DashIcon icon="solar:user-linear" className="size-4" />
        )}
      </span>
      <span className="truncate">{displayName}</span>
    </span>
  );
}
