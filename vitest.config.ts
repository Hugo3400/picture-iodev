import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // lib/share.ts refuse de se charger sans SHARE_SECRET (pas de valeur par
    // défaut permise, volontairement) : les tests qui l'importent ont besoin
    // d'une valeur factice, jamais utilisée pour de vrais secrets.
    env: { SHARE_SECRET: 'test-share-secret' },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
