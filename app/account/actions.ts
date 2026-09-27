'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function savePreferences(formData: FormData) {
  const cookieStore = await cookies()
  const name = String(formData.get('name') ?? '').trim().slice(0, 40)

  if (name) cookieStore.set('name', name, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  else cookieStore.delete('name')

  cookieStore.set('currency', formData.get('currency') === 'USD' ? 'USD' : 'VND', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect('/')
}
