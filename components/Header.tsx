import Link from 'next/link'
import type { Profile } from '@/lib/types'
import { ThemeToggle } from './ThemeToggle'

export function Header({ profile }: { profile: Profile }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="logo">
          Hydra<span>Store</span>
        </Link>
        <nav className="site-nav">
          <Link href="/products">Products</Link>
          <Link href="/blog">Journal</Link>
          <Link href="/about">About</Link>
          <Link href="/account">Account</Link>
        </nav>
        <div className="site-header__user">
          <span>Hi, {profile.name}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
