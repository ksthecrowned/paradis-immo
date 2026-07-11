import type { Property } from '@/types/property';
import type { ImageSourcePropType } from 'react-native';

/** Pointe-Noire center */
export const POINTE_NOIRE_REGION = {
  latitude: -4.7761,
  longitude: 11.8635,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
} as const;

/** @deprecated Use POINTE_NOIRE_REGION */
export const BRAZZAVILLE_REGION = POINTE_NOIRE_REGION;

function houseImages(): ImageSourcePropType[] {
  return [
    require('@/assets/images/house1.jpg'),
    require('@/assets/images/house2.jpg'),
    require('@/assets/images/house4.jpg'),
    require('@/assets/images/house5.jpg'),
    require('@/assets/images/house6.jpg'),
  ];
}

export const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    title: 'Villa Whispering Pines',
    description:
      'Belle villa R+1 située à Loandjili, dans un quartier calme et résidentiel de Pointe-Noire. La maison offre de beaux volumes, une cuisine équipée, un salon lumineux et un jardin arboré avec parking sécurisé.\n\nIdéale pour une famille, elle dispose de quatre chambres spacieuses, d’un débarras et d’un groupe électrogène pour une autonomie électrique. Climatisation dans les pièces principales, chauffe-eau et wifi inclus.',
    price: '70 000 000 FCFA',
    coverImage: '',
    location: 'Loandjili, Pointe-Noire',
    floor: 'R+1',
    surface: '180 m²',
    bedrooms: 4,
    bathrooms: 2,
    yearBuilt: 2018,
    condition: 'Très bon état',
    lotSize: '450 m²',
    parkingSpaces: 2,
    orientation: 'Sud-Ouest',
    landTitle: 'Titre foncier',
    mode: 'SALE',
    category: 'house',
    mapViews: ['neighborhood', 'streetView', 'tour360'],
    features: [
      'cuisine',
      'debarras',
      'climatisation',
      'chauffe_eau',
      'wifi',
      'parking',
      'jardin',
      'securite',
      'groupe_electrogene',
      'terrasse',
      'eau_courante',
    ],
    lat: -4.7825,
    lng: 11.8582,
    agencyId: 'ag-paradis-immo',
    agentId: 'ag-paradis-immo-1',
    listingStatus: 'AVAILABLE',
  },
  {
    id: '2',
    title: 'Appartement Centre-ville',
    description:
      'Appartement meublé au 2e étage en plein centre-ville de Pointe-Noire, proche des commerces et des services. Séjour confortable, cuisine fonctionnelle et balcon avec vue sur la rue.\n\nParfait pour une location longue durée : wifi, climatisation, chauffe-eau et eau courante. Accès sécurisé à l’immeuble et parking à proximité.',
    price: '100 000 FCFA',
    coverImage: '',
    location: 'Centre-ville, Pointe-Noire',
    floor: '2e étage',
    surface: '95 m²',
    bedrooms: 3,
    bathrooms: 1,
    yearBuilt: 2012,
    condition: 'Bon état',
    parkingSpaces: 1,
    orientation: 'Est',
    landTitle: 'Bail emphytéotique',
    mode: 'RENT_LONG',
    category: 'apartment',
    mapViews: ['neighborhood', 'streetView'],
    features: [
      'cuisine',
      'climatisation',
      'chauffe_eau',
      'wifi',
      'meuble',
      'balcon',
      'securite',
      'eau_courante',
      'parking',
    ],
    lat: -4.7698,
    lng: 11.8665,
    agencyId: 'ag-habitat-pn',
    agentId: 'ag-habitat-pn-1',
    listingStatus: 'OCCUPIED',
  },
  {
    id: '3',
    title: 'Maison Tié-Tié',
    description:
      'Maison cosy à Tié-Tié, proposée à la journée pour vos séjours à Pointe-Noire. Espace de vie agréable, cuisine équipée, wifi et climatisation pour un confort immédiat.\n\nIdéale pour un week-end en famille ou entre amis : jardin, terrasse ombragée et parking privé. Groupe électrogène disponible en cas de coupure.',
    price: '45 000 FCFA',
    coverImage: '',
    location: 'Tié-Tié, Pointe-Noire',
    floor: 'RDC',
    surface: '120 m²',
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2015,
    condition: 'Bon état',
    lotSize: '300 m²',
    parkingSpaces: 2,
    orientation: 'Nord',
    landTitle: 'Titre foncier',
    mode: 'RENT_SHORT',
    category: 'house',
    mapViews: ['neighborhood', 'tour360'],
    features: [
      'cuisine',
      'climatisation',
      'chauffe_eau',
      'wifi',
      'meuble',
      'jardin',
      'terrasse',
      'parking',
      'groupe_electrogene',
      'eau_courante',
    ],
    lat: -4.8012,
    lng: 11.8748,
    agencyId: 'ag-cote-sauvage',
    agentId: 'ag-cote-sauvage-2',
    listingStatus: 'AVAILABLE',
    isFeatured: true,
  },
  {
    id: '4',
    title: 'Terrain Mongo-Poukou',
    description:
      'Terrain constructible de 400 m² à Mongo-Poukou, dans un secteur en développement de Pointe-Noire. Accès facile, environnement calme, idéal pour un projet de villa ou d’investissement.\n\nTitre et bornage à vérifier avec l’agence. Possibilité de visite accompagnée sur rendez-vous.',
    price: '12 000 000 FCFA',
    coverImage: '',
    location: 'Mongo-Poukou, Pointe-Noire',
    surface: '400 m²',
    condition: 'Terrain nu',
    lotSize: '400 m²',
    landTitle: 'Attestation de détention coutumière',
    mode: 'SALE',
    category: 'land',
    mapViews: ['neighborhood'],
    features: ['parking', 'eau_courante'],
    lat: -4.7585,
    lng: 11.849,
    agencyId: 'ag-mongo-immo',
    agentId: 'ag-mongo-immo-1',
    listingStatus: 'SOLD',
  },
];

export function getPropertyById(id: string): Property | undefined {
  return MOCK_PROPERTIES.find((p) => p.id === id);
}

export function listPropertiesByAgency(agencyId: string): Property[] {
  return MOCK_PROPERTIES.filter((property) => property.agencyId === agencyId);
}

export function listPropertiesByAgent(agentId: string): Property[] {
  return MOCK_PROPERTIES.filter((property) => property.agentId === agentId);
}

export function getPropertyGallery(property: Property): ImageSourcePropType[] {
  if (property.coverImage?.startsWith('http')) {
    return [
      { uri: property.coverImage },
      ...(property.images ?? []).map((uri) => ({ uri })),
    ];
  }
  if (property.coverImage) {
    return [
      { uri: property.coverImage },
      ...(property.images ?? []).map((uri) => ({ uri })),
    ];
  }
  const images = houseImages();
  const offset = Number.parseInt(property.id, 10) || 0;
  return images.map((_, i) => images[(i + offset) % images.length]!);
}
