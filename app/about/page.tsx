import type { Metadata } from 'next'
import { RenderedAt } from '@/components/RenderedAt'

export const metadata: Metadata = {
  title: 'About | Hydra Store',
}

export default function AboutPage() {
  return (
    <article className="post">
      <h1>About Hydra Store</h1>
      <p>
        We started in 2019 with one sewing machine in a District 3 apartment. Today we are a team of eleven makers,
        three designers and one very patient accountant.
      </p>
      <p>
        Everything we sell is cut and sewn in our own workshop in Ho Chi Minh City, from natural fibres sourced within
        a day&apos;s drive. We make small batches, we repair what we sell, and we publish what every piece costs us to
        make.
      </p>
      <h2>Visit the workshop</h2>
      <p>Open Saturdays, 9am–1pm. Bring a garment that needs mending and we&apos;ll fix it for free.</p>
      <RenderedAt />
    </article>
  )
}
