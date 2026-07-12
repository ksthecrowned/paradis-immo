import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MagicLinkPurpose } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 30 * 60 * 1000;

@Injectable()
export class MagicLinkStore {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async create(
    email: string,
    purpose: MagicLinkPurpose,
  ): Promise<{ rawToken: string }> {
    const normalized = email.trim().toLowerCase();
    const rawToken = crypto.randomBytes(32).toString('base64url');
    await this.prisma.emailMagicLink.create({
      data: {
        email: normalized,
        tokenHash: this.hash(rawToken),
        purpose,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return { rawToken };
  }

  async consume(
    rawToken: string,
    purpose: MagicLinkPurpose,
  ): Promise<{ email: string }> {
    const row = await this.prisma.emailMagicLink.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (
      !row ||
      row.purpose !== purpose ||
      row.usedAt ||
      row.expiresAt < new Date()
    ) {
      throw new UnauthorizedException({
        code: 'MAGIC_LINK_INVALID',
        message: 'Lien invalide ou expiré',
      });
    }
    await this.prisma.emailMagicLink.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { email: row.email };
  }
}
