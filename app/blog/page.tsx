import type { Metadata } from 'next'
import Link from 'next/link'
import { RenderedAt } from '@/components/RenderedAt'
import { getPosts } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Journal | Hydra Store',
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <>
      <h1>Journal</h1>
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>
              <h2>{post.title}</h2>
            </Link>
            <p>{post.excerpt}</p>
            <small>
              {post.author} · {new Date(post.publishedAt).toDateString()}
            </small>
          </li>
        ))}
      </ul>
      <RenderedAt />
    </>
  )
}
