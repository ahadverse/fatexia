import { MigrationInterface, QueryRunner } from "typeorm";

// Seeds the three posts that used to live as a static array in
// frontend/apps/public/src/lib/posts.ts, now that the public blog is backed by this
// table instead. Keeps the public site's content from going blank the moment the
// frontend switches from the static list to a real fetch.
const SEED_POSTS = [
    {
        slug: 'why-payouts-should-never-trust-the-postback',
        title: 'Why your payout should never come from the postback',
        excerpt: "An advertiser postback tells you a conversion happened. It should never get to tell you what it was worth. Here's why that distinction matters.",
        publishedAt: '2026-07-10',
        content: [
            "A conversion postback is, structurally, a message from someone else's server telling your network what to pay out. If your payout logic trusts that number directly, you've handed pricing control to whichever party benefits from inflating it.",
            "Fatexia's tracker treats a postback as a single fact: a conversion happened, at this time, for this click ID. Nothing more. The amount owed is always looked up fresh from the offer's own payout rule at the moment the conversion is processed — the same rule an affiliate can see before they ever send traffic.",
            "This isn't a subtle implementation detail. It's the difference between a payout you can reproduce from public information and one you have to take on faith. When a rule changes, it changes going forward — it doesn't retroactively rewrite what a past conversion was worth, and it never depends on a number typed into someone else's system.",
            "The practical effect: fewer disputes, because there's less to dispute. The math is always the same math, computed the same way, from a rule both sides can point to.",
        ].join('\n\n'),
    },
    {
        slug: 'datacenter-traffic-is-the-easy-problem',
        title: "Datacenter traffic is the easy fraud problem. Here's the hard one.",
        excerpt: 'Blocking AWS and DigitalOcean IPs is nearly free. The traffic that actually costs networks money looks like a real residential visitor — because in a sense, it is.',
        publishedAt: '2026-07-16',
        content: [
            "Every serious click-fraud discussion starts with datacenter filtering, and for good reason: it's cheap, it's local, and it catches a meaningful share of low-effort bots. If a click's ASN organization resolves to a known hosting provider, you can flag it before it ever touches your database, at zero marginal cost.",
            "But datacenter filtering only catches traffic that never bothered to hide. The traffic that actually costs a network money runs through residential proxy networks — real household IP addresses, rented out through consumer apps and SDKs, indistinguishable from a genuine visitor at the ASN level. A residential proxy IP belongs to a real ISP, in a real neighborhood, because it is one.",
            'That\'s the problem no local blocklist solves. It requires a live, crowdsourced reputation signal — a database of "this specific address has been seen behaving like a proxy exit point recently" — which is fundamentally a different kind of data than "this ASN belongs to Amazon." It\'s the one place in our fraud pipeline where we reach for an external signal, and we reach for it narrowly: only after the free local checks have already run, cached aggressively, and never as the sole reason to block a click outright.',
            'The honest framing: no single layer solves fraud. A network that tells you otherwise is selling a slogan, not a system.',
        ].join('\n\n'),
    },
    {
        slug: 'one-network-done-well',
        title: "Why we're building one network instead of a platform for many",
        excerpt: "White-label CPA platforms optimize for serving many networks adequately. We'd rather serve one network well.",
        publishedAt: '2026-07-22',
        content: [
            "Most of the CPA tracking software on the market is built to be resold — a white-label platform where the vendor's customer is another network operator, and the affiliates and advertisers are two steps removed from the people actually building the product.",
            'That model optimizes for breadth: enough configurability that any network can bend it to their shape, at the cost of every specific network getting a slightly generic experience. Multi-tenancy adds real architectural weight, too — isolation guarantees, per-tenant configuration, cross-tenant admin tooling — none of which makes the product better for the one network actually running on it.',
            "Fatexia made the opposite bet: one network, no tenants, no white-label layer. Every design decision — the payout math, the fraud pipeline, the reporting — is made for the offers and affiliates actually on this network, not for a hypothetical operator we're serving indirectly.",
        ].join('\n\n'),
    },
];

export class CreateBlogPosts1785177337849 implements MigrationInterface {
    name = 'CreateBlogPosts1785177337849'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."blog_posts_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "blog_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "slug" character varying NOT NULL, "excerpt" character varying, "content" text NOT NULL, "status" "public"."blog_posts_status_enum" NOT NULL DEFAULT 'DRAFT', "authorUserId" uuid, "publishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dd2add25eac93daefc93da9d387" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5b2818a2c45c3edb9991b1c7a5" ON "blog_posts" ("slug") `);

        for (const post of SEED_POSTS) {
            await queryRunner.query(
                `INSERT INTO "blog_posts" ("title", "slug", "excerpt", "content", "status", "publishedAt") VALUES ($1, $2, $3, $4, 'PUBLISHED', $5)`,
                [post.title, post.slug, post.excerpt, post.content, post.publishedAt],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_5b2818a2c45c3edb9991b1c7a5"`);
        await queryRunner.query(`DROP TABLE "blog_posts"`);
        await queryRunner.query(`DROP TYPE "public"."blog_posts_status_enum"`);
    }

}
