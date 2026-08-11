/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Les noms de fichiers dans public/uploads incluent déjà un timestamp +
        // suffixe aléatoire (voir lib/publicUploads.ts) : l'URL ne sert jamais deux
        // contenus différents, donc un cache longue durée est sans risque.
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
