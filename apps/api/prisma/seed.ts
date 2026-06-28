import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  // 1. Country: Congo (CG) — XAF currency, +242 prefix
  const cg = await prisma.country.upsert({
    where: { code: 'CG' },
    update: {},
    create: {
      code: 'CG',
      name: 'Congo',
      currency: 'XAF',
      phonePrefix: '+242',
      activeProviders: ['AIRTEL'],
    },
  });
  console.log(`✓ Country: ${cg.name} (${cg.code})`);

  // 2. Brazzaville
  const bzv = await prisma.city.upsert({
    where: { name_countryId: { name: 'Brazzaville', countryId: cg.id } },
    update: {},
    create: { name: 'Brazzaville', countryId: cg.id },
  });

  const bzvArrondissements = [
    { name: 'Makélékélé', number: 1 },
    { name: 'Bacongo', number: 2 },
    { name: 'Poto-Poto', number: 3 },
    { name: 'Moungali', number: 4 },
    { name: 'Ouenzé', number: 5 },
    { name: 'Talangaï', number: 6 },
    { name: 'Mfilou', number: 7 },
    { name: 'Madibou', number: 8 },
    { name: 'Djiri', number: 9 },
  ];
  for (const a of bzvArrondissements) {
    const arr = await prisma.arrondissement.upsert({
      where: { name_cityId: { name: a.name, cityId: bzv.id } },
      update: { number: a.number },
      create: { name: a.name, number: a.number, cityId: bzv.id },
    });
    await prisma.quartier.upsert({
      where: {
        name_arrondissementId: { name: `${a.name}-Centre`, arrondissementId: arr.id },
      },
      update: {},
      create: { name: `${a.name}-Centre`, arrondissementId: arr.id },
    });
  }
  console.log(`✓ Brazzaville: ${bzvArrondissements.length} arrondissements`);

  // 3. Pointe-Noire
  const pnr = await prisma.city.upsert({
    where: { name_countryId: { name: 'Pointe-Noire', countryId: cg.id } },
    update: {},
    create: { name: 'Pointe-Noire', countryId: cg.id },
  });

  const pnrArrondissements = [
    { name: 'Lumumba', number: 1 },
    { name: 'Mvou-Mvou', number: 2 },
    { name: 'Tié-Tié', number: 3 },
    { name: 'Loandjili', number: 4 },
    { name: 'Mongo-Mpoukou', number: 5 },
    { name: 'Ngoyo', number: 6 },
  ];
  for (const a of pnrArrondissements) {
    const arr = await prisma.arrondissement.upsert({
      where: { name_cityId: { name: a.name, cityId: pnr.id } },
      update: { number: a.number },
      create: { name: a.name, number: a.number, cityId: pnr.id },
    });
    await prisma.quartier.upsert({
      where: {
        name_arrondissementId: { name: `${a.name}-Centre`, arrondissementId: arr.id },
      },
      update: {},
      create: { name: `${a.name}-Centre`, arrondissementId: arr.id },
    });
  }
  console.log(`✓ Pointe-Noire: ${pnrArrondissements.length} arrondissements`);

  // 4. Paradis Immo platform organization (AGENCY type, APPROVED)
  const paradis = await prisma.organization.upsert({
    where: { id: 'org_paradis_immo' },
    update: {},
    create: {
      id: 'org_paradis_immo',
      name: 'Paradis Immo',
      type: 'AGENCY',
      affiliationStatus: 'APPROVED',
      countryId: cg.id,
    },
  });
  console.log(`✓ Organization: ${paradis.name} (${paradis.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });