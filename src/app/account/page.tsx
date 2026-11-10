import { AccountPage } from '@/components/InfoPages'
import { accountMetadata } from '@/lib/pageMetadata'

export const metadata = accountMetadata()

export default function Page() {
  return <AccountPage />
}
