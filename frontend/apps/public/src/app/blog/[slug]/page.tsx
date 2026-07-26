import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { GlowBackdrop, ButtonLink } from '@/components/marketing';
import { POSTS, getPostBySlug } from '@/lib/posts';

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <GlowBackdrop />
        <div className="container-page max-w-3xl py-16 sm:py-20">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to Blog
          </Link>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-gradient sm:text-4xl">{post.title}</h1>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</time>
            <span>·</span>
            <span>{post.readingTime}</span>
          </div>
        </div>
      </section>

      <article className="container-page max-w-3xl py-14">
        <div className="space-y-6 text-base leading-relaxed text-foreground/90">
          {post.content.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Want a network that works like this?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Free to join, reviewed manually, transparent from the first click.</p>
          <div className="mt-6">
            <ButtonLink href="/register" withArrow>
              Become an Affiliate
            </ButtonLink>
          </div>
        </div>
      </article>

      {/* More posts */}
      {others.length > 0 && (
        <section className="border-t border-border py-16">
          <div className="container-page max-w-3xl">
            <h2 className="text-lg font-semibold text-foreground">Keep reading</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {others.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group block h-full">
                  <article className="card-hover flex h-full flex-col rounded-xl border border-border bg-card p-6">
                    <h3 className="text-base font-semibold text-foreground group-hover:text-primary">{p.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Read more <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
