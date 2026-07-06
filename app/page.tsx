export const dynamic = 'force-dynamic'

import { getDb } from '@/lib/db'
import { cleanupExpiredPublicUploads } from '@/lib/publicUploads'
import ImageHost from '@/components/ImageHost'

export default async function Home() {
  cleanupExpiredPublicUploads(getDb())
  return <ImageHost />
}
