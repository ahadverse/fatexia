import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHero, Section } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { getPublishedPosts } from '@/lib/posts';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Notes on CPA tracking, fraud detection, and how Fatexia is built.',
};

export default async function BlogIndexPage() {
  const posts = (await getPublishedPosts()).slice().reverse();
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero eyebrow="Blog" title="Notes from behind the tracker" description="Plain-language writing on CPA tracking, fraud detection, and how Fatexia is built." />

      <Section>
        {/* Featured */}
        {featured && (
          <Reveal>
            <Link href={`/blog/${featured.slug}`} className="group block">
              <article className="ring-gradient card-hover overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-10">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 font-medium text-primary">Latest</span>
                  <time dateTime={featured.publishedAt}>
                    {new Date(featured.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </time>
                  <span>·</span>
                  <span>{featured.readingTime}</span>
                </div>
                <h2 className="mt-4 max-w-3xl text-2xl font-bold tracking-tight text-foreground group-hover:text-primary sm:text-3xl">{featured.title}</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{featured.excerpt}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Read article <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </article>
            </Link>
          </Reveal>
        )}

        {/* Rest */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {rest.map((post, i) => (
            <Reveal key={post.slug} delay={i * 60}>
              <Link href={`/blog/${post.slug}`} className="group block h-full">
                <article className="card-hover flex h-full flex-col rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                    <span>·</span>
                    <span>{post.readingTime}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-foreground group-hover:text-primary">{post.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    Read more <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </article>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
