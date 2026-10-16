'use client';

import { DashIcon } from '@/components/dash-icon';
import Image from 'next/image';
import { useState } from 'react';

export interface UserIdentityProps {
  size?: 'sm' | 'md' | 'lg';
  name: string | null | undefined;
  avatarUrl?: string | null;
  fallbackName?: string;
}

const SIZE_CLASS: Record<NonNullable<UserIdentityProps['size']>, string> = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-10',
};

export function UserIdentity({
  size = 'md',
  name,
  avatarUrl,
  fallbackName = 'Utilisateur',
}: UserIdentityProps): React.JSX.Element {
  const displayName = name?.trim() || fallbackName;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showAvatar = Boolean(avatarUrl) && failedUrl !== avatarUrl;
  const px = size === 'sm' ? 24 : size === 'lg' ? 40 : 32;

  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-normal text-active">
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/10 text-muted ${SIZE_CLASS[size]}`}
      >
        {showAvatar && avatarUrl ? (
          <Image
            src={avatarUrl}
            width={px}
            height={px}
            alt={displayName}
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
