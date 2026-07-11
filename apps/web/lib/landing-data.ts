export interface LandingProperty {
  id: number;
  price: number;
  name: string;
  location: string;
  beds: number;
  baths: number;
  size: string;
  isPopular: boolean;
  image: string;
  type: 'rent' | 'buy' | 'sell';
}

export const LANDING_PROPERTIES: LandingProperty[] = [
  {
    id: 1,
    price: 2095,
    name: 'Palm Harbor',
    location: '2699 Green Valley, Highland Lake, FL',
    beds: 3,
    baths: 2,
    size: '5x7 m²',
    isPopular: true,
    image: '/landing/house1.jpg',
    type: 'rent',
  },
  {
    id: 2,
    price: 2700,
    name: 'Beverly Springfield',
    location: '2821 Lake Sevilla, Palm Harbor, TX',
    beds: 4,
    baths: 2,
    size: '6x7.5 m²',
    isPopular: true,
    image: '/landing/house2.jpg',
    type: 'rent',
  },
  {
    id: 3,
    price: 4550,
    name: 'Faulkner Ave',
    location: '909 Woodland St, Michigan, IN',
    beds: 4,
    baths: 3,
    size: '8x10 m²',
    isPopular: true,
    image: '/landing/house3.jpg',
    type: 'rent',
  },
  {
    id: 4,
    price: 2400,
    name: 'St. Crystal',
    location: '210 US Highway, Highland Lake, FL',
    beds: 4,
    baths: 2,
    size: '6x8 m²',
    isPopular: false,
    image: '/landing/house4.jpg',
    type: 'rent',
  },
  {
    id: 5,
    price: 1500,
    name: 'Cove Red',
    location: '243 Curlew Road, Palm Harbor, TX',
    beds: 2,
    baths: 1,
    size: '5x7.5 m²',
    isPopular: false,
    image: '/landing/house5.jpg',
    type: 'rent',
  },
  {
    id: 6,
    price: 1600,
    name: 'Tarpon Bay',
    location: '103 Lake Shores, Michigan, IN',
    beds: 3,
    baths: 1,
    size: '5x7 m²',
    isPopular: false,
    image: '/landing/house6.jpg',
    type: 'rent',
  },
];
