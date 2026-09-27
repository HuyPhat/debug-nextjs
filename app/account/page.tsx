import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { RenderedAt } from '@/components/RenderedAt'
import { savePreferences } from './actions'

export const metadata: Metadata = {
  title: 'Your account | Hydra Store',
}

export default async function AccountPage() {
  const cookieStore = await cookies()
  const name = cookieStore.get('name')?.value ?? ''
  const currency = cookieStore.get('currency')?.value === 'USD' ? 'USD' : 'VND'

  return (
    <article className="post">
      <h1>Your account</h1>
      <p>Your name and currency are stored in cookies and used to personalise every page.</p>
      <form action={savePreferences} className="account-form">
        <label>
          Name
          <input name="name" defaultValue={name} placeholder="e.g. Huy" />
        </label>
        <label>
          Currency
          <select name="currency" defaultValue={currency}>
            <option value="VND">VND (₫)</option>
            <option value="USD">USD ($)</option>
          </select>
        </label>
        <button type="submit" className="btn">
          Save
        </button>
      </form>
      <RenderedAt />
    </article>
  )
}
