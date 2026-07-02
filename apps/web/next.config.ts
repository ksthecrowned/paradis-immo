import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/proprietaire', destination: '/owner/dashboard', permanent: false },
      {
        source: '/proprietaire/dashboard',
        destination: '/owner/dashboard',
        permanent: false,
      },
      {
        source: '/proprietaire/biens/nouveau',
        destination: '/owner/properties/add',
        permanent: false,
      },
      {
        source: '/proprietaire/biens/:id/creneaux',
        destination: '/owner/properties/:id/visit-slots',
        permanent: false,
      },
      {
        source: '/proprietaire/biens/:id',
        destination: '/owner/properties/:id',
        permanent: false,
      },
      {
        source: '/proprietaire/biens',
        destination: '/owner/properties',
        permanent: false,
      },
      {
        source: '/proprietaire/visites',
        destination: '/owner/visits',
        permanent: false,
      },
      {
        source: '/proprietaire/baux',
        destination: '/owner/leases',
        permanent: false,
      },
      {
        source: '/proprietaire/paiements',
        destination: '/owner/payments',
        permanent: false,
      },
      {
        source: '/proprietaire/maintenance',
        destination: '/owner/maintenance',
        permanent: false,
      },
      {
        source: '/proprietaire/mandat',
        destination: '/owner/mandate',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
