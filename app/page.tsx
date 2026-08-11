export const dynamic = 'force-dynamic'

import { getDb } from '@/lib/db'
import { cleanupExpiredPublicUploads } from '@/lib/publicUploads'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import ImageHost from '@/components/ImageHost'

export default async function Home() {
  cleanupExpiredPublicUploads(getDb())
  const user = await getSession()
  return <ImageHost isAdmin={isAdmin(user)} />
}
