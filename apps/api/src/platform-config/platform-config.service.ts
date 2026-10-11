import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicAnnouncement {
  title: string;
  body: string;
  audience: string;
  startsAt: string;
  endsAt: string | null;
}

export interface PlatformVersionPolicy {
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
  message: string | null;
}

export interface PublicAppConfig {
  announcements: PublicAnnouncement[];
  /**
   * Per-platform version policy, keyed by lowercase platform
   * (`ios`, `android`, `web`). The mobile reads its own key and forces an
   * update when the installed version is lower than `minVersion` (spec 14).
   */
  versions: Record<string, PlatformVersionPolicy>;
  /** Public feature flags — empty until admin settings land. */
  featureFlags: Record<string, boolean>;
}

/**
 * Public bootstrap configuration for web and mobile (specs 12/14):
 * active announcements, minimum supported app version per platform and
 * public feature flags. No authentication.
 */
@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAppConfig(): Promise<PublicAppConfig> {
    const now = new Date();
    const [announcementRows, versionRows] = await Promise.all([
      this.prisma.systemAnnouncement.findMany({
        where: {
          active: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        orderBy: { startsAt: 'desc' },
        take: 10,
      }),
      this.prisma.appVersionPolicy.findMany(),
    ]);

    const versions: Record<string, PlatformVersionPolicy> = {};
    for (const row of versionRows) {
      versions[row.platform.toLowerCase()] = {
        minVersion: row.minVersion,
        latestVersion: row.latestVersion,
        storeUrl: row.storeUrl,
        message: row.message,
      };
    }

    return {
      announcements: announcementRows.map((a) => ({
        title: a.title,
        body: a.body,
        audience: a.audience,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() ?? null,
      })),
      versions,
      featureFlags: {},
    };
  }
}
