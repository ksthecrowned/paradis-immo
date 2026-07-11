/**
 * Stable seed UUIDs — keep fixed so re-seeds and tests stay deterministic.
 * Do not regenerate casually; shared local DBs and e2e specs depend on them.
 */
export const SEED_IDS = {
  orgParadisImmo: '7beb9e56-cd2b-4235-befe-e0aa5f2b3b4b',
  orgOwner: 'dc9625dc-388d-4c66-ae4a-af6b9f3524e8',
  orgCoteSauvage: '6bb0b69e-7450-4ccb-95bf-6257688c455d',
  orgHabitatPn: '2ff0710b-9f7d-404c-b1db-c4b6c54772ca',

  userAdmin: '264c573a-c000-446e-b990-70f1ccb0a1fd',
  userAgent: '2a036ccd-fb37-4baf-ac47-ce70b42af47f',
  userAgentParadis2: 'f96f3e4f-df26-44b4-b19b-29b6069531b2',
  userAgentCote: '07164a84-b60b-4855-8f76-7dfb834297a4',
  userAgentHabitat: '61181f29-f925-4aab-92b7-139dbeab1035',
  userOwner: 'ec93037b-cd31-499f-9e14-f620e44eceeb',
  userTenant: '5e0becd9-83fc-48af-b9db-f2c9a3918d75',

  propRentLong: '823b9231-0eb7-4550-8dc6-892fd686496d',
  propSale: '29faa8b3-dd07-46ba-96c1-6f5f536b83ec',
  propShort: 'b5afc862-ec6d-466f-bcee-764e6704dd8c',
  propLand: 'a50c3b1b-9cb9-4035-8326-552c1c5de0c3',

  saleInquiry: '477405ea-a863-4ec9-a81c-89aa0b635db8',
  paymentCash: 'fd7e35c5-f02e-4910-bb17-74a7b7aba6c8',

  mediaRent: [
    '4cd5ffbd-1a77-455f-a0d6-545212718c52',
    'cc4b94f7-a745-4bfe-8803-0c9a7825d246',
    '781d05d2-c347-4a1d-a841-6cfe85860e3e',
  ],
  mediaSale: [
    '1eda713c-99a1-48c6-bdff-95a228fe303e',
    'fd112ea4-0b08-4ade-ba02-45eb1f6955f3',
    'c48e0c78-8a6d-4a1b-9d28-7cf4ce927066',
  ],
  mediaShort: [
    'bf782fd0-c22c-4029-9b92-af6b6ae4c0fb',
    '73268eba-6d1c-4542-9225-a6a6caf1a745',
    'c70a4c3e-a349-48fe-9609-71489bba26f5',
  ],
  mediaLand: [
    '8f2bae0c-9eb9-481f-9bf1-88d775acad17',
    'a8cd90c5-5b14-47e1-bb14-1cc89a6dec9c',
  ],

  visitSlots: [
    '32c79658-6603-45b0-85ef-dd9fb88a134d',
    '85533434-d97f-47cd-884e-c7b9330839a9',
    'e0dca77b-4bcb-478f-b6ff-32f27c0a201d',
    '0b5d6734-d73f-45b5-a6f9-2830229c297d',
    'f8bdf61f-7159-4349-8e96-e4446071de28',
    'b8c5292d-8f71-41a5-9b25-e3045859e0c2',
    '02796600-633d-47cf-be13-bf8663d9a6fd',
    'd381334c-aad9-4804-a8bc-56bdf9cc972b',
    '896d3f6c-7767-4001-8234-719ca258a647',
    '970f7827-5464-4f35-b07a-a7237d261551',
  ],
} as const;

export const PARADIS_IMMO_ORG_ID = SEED_IDS.orgParadisImmo;
