import 'dotenv/config';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaService } from '../src/prisma/prisma.service';
import { renderRentReceiptPdf } from '../src/leases/rent-receipt-pdf';

type LegacyDocument = {
  id: string;
  url: string | null;
  fileKey: string | null;
};

type DocumentTable = 'propertyDocument' | 'tenantDocument' | 'leaseDocument';

type PrivateKeyReference = {
  table: string;
  id: string;
  key: string;
  setPrivateKey: (key: string) => Promise<unknown>;
};

const PRIVATE_KEY_PREFIXES = [
  'private/',
  'property-documents/',
  'tenant-documents/',
  'lease-documents/',
  'private/quittances/',
];

const publicBucket = process.env.R2_BUCKET ?? '';
const privateBucket = process.env.R2_PRIVATE_BUCKET ?? '';
const publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
const accountId = process.env.R2_ACCOUNT_ID ?? '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';

function requireConfig(): void {
  const missing = [
    !publicBucket && 'R2_BUCKET',
    !privateBucket && 'R2_PRIVATE_BUCKET',
    !publicUrl && 'R2_PUBLIC_URL',
    !accountId && 'R2_ACCOUNT_ID',
    !accessKeyId && 'R2_ACCESS_KEY_ID',
    !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }
  if (publicBucket === privateBucket) {
    throw new Error('R2_PRIVATE_BUCKET must be a dedicated private bucket');
  }
}

function sourceKeyFromUrl(url: string): string | null {
  const prefix = `${publicUrl}/`;
  return url.startsWith(prefix)
    ? decodeURIComponent(url.slice(prefix.length))
    : null;
}

function encodeCopySource(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function privateObjectExists(client: S3Client, key: string) {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: privateBucket, Key: key }),
    );
    return true;
  } catch (error) {
    const response = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      response.name === 'NotFound' ||
      response.name === 'NoSuchKey' ||
      response.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }
    throw error;
  }
}

async function publicObjectExists(client: S3Client, key: string) {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: publicBucket, Key: key }),
    );
    return true;
  } catch (error) {
    const response = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      response.name === 'NotFound' ||
      response.name === 'NoSuchKey' ||
      response.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }
    throw error;
  }
}

function isAlreadyPrivate(key: string): boolean {
  return PRIVATE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function main(): Promise<void> {
  requireConfig();
  const prisma = new PrismaService();
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await prisma.$connect();
    const existingColumns = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('PropertyDocument', 'TenantDocument', 'LeaseDocument')
        AND column_name = 'fileKey'
    `;
    const migratedTables = new Set(
      existingColumns.map((column) => column.table_name),
    );
    const missingTables = [
      'PropertyDocument',
      'TenantDocument',
      'LeaseDocument',
    ].filter((table) => !migratedTables.has(table));
    if (missingTables.length) {
      throw new Error(
        `Database schema is missing fileKey on ${missingTables.join(', ')}. No files were copied. From apps/api, run "bunx prisma migrate deploy", then rerun "bun run storage:migrate-documents".`,
      );
    }

    const tables: Array<{
      name: DocumentTable;
      rows: LegacyDocument[];
      setPrivateKey: (id: string, key: string) => Promise<unknown>;
    }> = [
      {
        name: 'propertyDocument',
        rows: await prisma.propertyDocument.findMany({
          where: { fileKey: null, url: { not: null } },
          select: { id: true, url: true, fileKey: true },
        }),
        setPrivateKey: (id, key) =>
          prisma.propertyDocument.update({
            where: { id },
            data: { fileKey: key, url: null },
          }),
      },
      {
        name: 'tenantDocument',
        rows: await prisma.tenantDocument.findMany({
          where: { fileKey: null, url: { not: null } },
          select: { id: true, url: true, fileKey: true },
        }),
        setPrivateKey: (id, key) =>
          prisma.tenantDocument.update({
            where: { id },
            data: { fileKey: key, url: null },
          }),
      },
      {
        name: 'leaseDocument',
        rows: await prisma.leaseDocument.findMany({
          where: { fileKey: null, url: { not: null } },
          select: { id: true, url: true, fileKey: true },
        }),
        setPrivateKey: (id, key) =>
          prisma.leaseDocument.update({
            where: { id },
            data: { fileKey: key, url: null },
          }),
      },
    ];

    const keyReferences: PrivateKeyReference[] = [];
    const [
      receipts,
      mandates,
      expenses,
      statements,
      reconciliationRuns,
      kycSubmissions,
      exports,
    ] = await Promise.all([
      prisma.rentReceipt.findMany({ select: { id: true, fileKey: true } }),
      prisma.mandate.findMany({
        where: { signedDocumentKey: { not: null } },
        select: { id: true, signedDocumentKey: true },
      }),
      prisma.expense.findMany({
        where: { invoiceKey: { not: null } },
        select: { id: true, invoiceKey: true },
      }),
      prisma.ownerStatement.findMany({ select: { id: true, fileKey: true } }),
      prisma.reconciliationRun.findMany({
        select: { id: true, fileKey: true },
      }),
      prisma.kycSubmission.findMany({ select: { id: true, fileKey: true } }),
      prisma.dataExportRequest.findMany({
        where: { fileKey: { not: null } },
        select: { id: true, fileKey: true },
      }),
    ]);
    keyReferences.push(
      ...receipts.map((row) => ({
        table: 'rentReceipt' as const,
        id: row.id,
        key: row.fileKey,
        setPrivateKey: (key: string) =>
          prisma.rentReceipt.update({
            where: { id: row.id },
            data: { fileKey: key },
          }),
      })),
      ...mandates.flatMap((row) =>
        row.signedDocumentKey
          ? [
              {
                table: 'mandate' as const,
                id: row.id,
                key: row.signedDocumentKey,
                setPrivateKey: (key: string) =>
                  prisma.mandate.update({
                    where: { id: row.id },
                    data: { signedDocumentKey: key },
                  }),
              },
            ]
          : [],
      ),
      ...expenses.flatMap((row) =>
        row.invoiceKey
          ? [
              {
                table: 'expense' as const,
                id: row.id,
                key: row.invoiceKey,
                setPrivateKey: (key: string) =>
                  prisma.expense.update({
                    where: { id: row.id },
                    data: { invoiceKey: key },
                  }),
              },
            ]
          : [],
      ),
      ...statements.map((row) => ({
        table: 'ownerStatement' as const,
        id: row.id,
        key: row.fileKey,
        setPrivateKey: (key: string) =>
          prisma.ownerStatement.update({
            where: { id: row.id },
            data: { fileKey: key },
          }),
      })),
      ...reconciliationRuns.map((row) => ({
        table: 'reconciliationRun' as const,
        id: row.id,
        key: row.fileKey,
        setPrivateKey: (key: string) =>
          prisma.reconciliationRun.update({
            where: { id: row.id },
            data: { fileKey: key },
          }),
      })),
      ...kycSubmissions.map((row) => ({
        table: 'kycSubmission' as const,
        id: row.id,
        key: row.fileKey,
        setPrivateKey: (key: string) =>
          prisma.kycSubmission.update({
            where: { id: row.id },
            data: { fileKey: key },
          }),
      })),
      ...exports.flatMap((row) =>
        row.fileKey
          ? [
              {
                table: 'dataExportRequest' as const,
                id: row.id,
                key: row.fileKey,
                setPrivateKey: (key: string) =>
                  prisma.dataExportRequest.update({
                    where: { id: row.id },
                    data: { fileKey: key },
                  }),
              },
            ]
          : [],
      ),
    );

    const groups = new Map<
      string,
      Array<{
        table: string;
        id: string;
        setPrivateKey: (key: string) => Promise<unknown>;
        targetKey: string;
      }>
    >();
    let skipped = 0;
    let alreadyPrivate = 0;
    for (const table of tables) {
      for (const row of table.rows) {
        if (!row.url) continue;
        const sourceKey = sourceKeyFromUrl(row.url);
        if (!sourceKey) {
          skipped++;
          console.warn(
            `Skipped ${table.name}/${row.id}: URL is not hosted on R2_PUBLIC_URL`,
          );
          continue;
        }

        const filename = sourceKey.split('/').pop() || 'document';
        const targetKey = `private/legacy-documents/${table.name}/${row.id}/${filename}`;
        const entries = groups.get(sourceKey) ?? [];
        entries.push({
          table: table.name,
          id: row.id,
          setPrivateKey: (key) => table.setPrivateKey(row.id, key),
          targetKey,
        });
        groups.set(sourceKey, entries);
      }
    }

    for (const reference of keyReferences) {
      if (isAlreadyPrivate(reference.key)) {
        alreadyPrivate++;
        continue;
      }
      if (reference.key.startsWith('inline/')) {
        skipped++;
        console.warn(
          `Skipped ${reference.table}/${reference.id}: stored key is an inline fallback, not an R2 object`,
        );
        continue;
      }
      const filename = reference.key.split('/').pop() || 'document';
      const targetKey = `private/legacy-documents/${reference.table}/${reference.id}/${filename}`;
      const entries = groups.get(reference.key) ?? [];
      entries.push({
        table: reference.table,
        id: reference.id,
        setPrivateKey: reference.setPrivateKey,
        targetKey,
      });
      groups.set(reference.key, entries);
    }

    let migrated = 0;
    let missingSource = 0;
    let regeneratedReceipts = 0;
    let publicObjectsRetained = 0;
    const completedSources = new Set<string>();
    for (const [sourceKey, entries] of groups) {
      if (!(await publicObjectExists(client, sourceKey))) {
        const receiptEntries = entries.filter(
          (entry) => entry.table === 'rentReceipt',
        );
        const otherEntries = entries.filter(
          (entry) => entry.table !== 'rentReceipt',
        );
        for (const entry of receiptEntries) {
          const receipt = await prisma.rentReceipt.findUnique({
            where: { id: entry.id },
            include: {
              rentSchedule: {
                include: {
                  lease: {
                    include: {
                      tenant: { select: { name: true, phone: true } },
                      property: {
                        select: {
                          address: true,
                          ownerId: true,
                          organization: { select: { name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          if (!receipt) {
            throw new Error(
              `Cannot regenerate missing rent receipt ${entry.id}: database record not found`,
            );
          }
          const landlord = await prisma.user.findUnique({
            where: { id: receipt.rentSchedule.lease.property.ownerId },
            select: { name: true, phone: true },
          });
          const schedule = receipt.rentSchedule;
          const buffer = await renderRentReceiptPdf({
            number: receipt.number,
            issuedAt: receipt.issuedAt,
            periodStart: schedule.periodStart ?? schedule.dueDate,
            periodEnd: schedule.periodEnd ?? schedule.dueDate,
            rentAmount: schedule.rentPart.toString(),
            chargesAmount: schedule.chargesPart.toString(),
            totalAmount: schedule.amount.toString(),
            currency: schedule.currency,
            tenantName:
              schedule.lease.tenant?.name ??
              schedule.lease.tenant?.phone ??
              schedule.lease.invitedPhone ??
              '—',
            landlordName: landlord?.name ?? landlord?.phone ?? '—',
            agencyName: schedule.lease.property.organization.name,
            propertyAddress: schedule.lease.property.address,
          });
          await client.send(
            new PutObjectCommand({
              Bucket: privateBucket,
              Key: entry.targetKey,
              Body: buffer,
              ContentType: 'application/pdf',
            }),
          );
          await entry.setPrivateKey(entry.targetKey);
          migrated++;
          regeneratedReceipts++;
          console.warn(
            `Regenerated missing rent receipt ${receipt.number} from its database record`,
          );
        }
        if (otherEntries.length > 0) {
          missingSource++;
          console.warn(
            `Skipped ${otherEntries.length} reference(s) to missing public object ${sourceKey}`,
          );
        }
        continue;
      }
      for (const { targetKey } of entries) {
        if (!(await privateObjectExists(client, targetKey))) {
          await client.send(
            new CopyObjectCommand({
              Bucket: privateBucket,
              Key: targetKey,
              CopySource: encodeCopySource(publicBucket, sourceKey),
            }),
          );
        }
      }

      for (const { setPrivateKey, targetKey } of entries) {
        await setPrivateKey(targetKey);
        migrated++;
      }
      completedSources.add(sourceKey);
    }

    for (const [sourceKey, entries] of groups) {
      if (!completedSources.has(sourceKey)) continue;
      const propertyMedia = await prisma.propertyMedia.findFirst({
        where: {
          url: {
            in: [
              `${publicUrl}/${sourceKey}`,
              ...entries.flatMap(({ id }) => {
                const doc = tables
                  .flatMap((table) => table.rows)
                  .find((row) => row.id === id);
                return doc?.url ? [doc.url] : [];
              }),
            ],
          },
        },
        select: { id: true },
      });
      const messageAttachment = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Message"
        WHERE "attachments" IS NOT NULL
          AND "attachments"::text LIKE ${`%${sourceKey}%`}
        LIMIT 1
      `;
      if (propertyMedia || messageAttachment.length > 0) {
        publicObjectsRetained++;
        console.warn(
          `Retained a public object still referenced by a public-media or message-attachment record: ${sourceKey}`,
        );
      } else {
        await client.send(
          new DeleteObjectCommand({ Bucket: publicBucket, Key: sourceKey }),
        );
      }
    }

    console.log(
      `Migrated ${migrated} file references (${regeneratedReceipts} rent receipts regenerated); already private ${alreadyPrivate}; skipped ${skipped}; unresolved missing public objects ${missingSource}; retained ${publicObjectsRetained} public objects still referenced by other records.`,
    );
    if (skipped > 0 || missingSource > 0) {
      throw new Error(
        `Migration incomplete: ${skipped} reference(s) were skipped and ${missingSource} public object(s) were missing. Resolve these references before deployment.`,
      );
    }
  } finally {
    client.destroy();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Private document migration failed:', error);
  process.exitCode = 1;
});
