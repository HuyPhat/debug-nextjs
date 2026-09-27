import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RenderedAt } from '@/components/RenderedAt'
import { getPost } from '@/lib/db'

export async function generateMetadata({ params }: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post ? `${post.title} | Hydra Store` : 'Post not found | Hydra Store', description: post?.excerpt }
}

export default async function BlogPostPage({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <article className="post">
      <h1>{post.title}</h1>
      <small>
        {post.author} · {new Date(post.publishedAt).toDateString()}
      </small>
      {post.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <RenderedAt />
    </article>
  )
}
