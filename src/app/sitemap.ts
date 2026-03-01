import { getAllPosts } from "@/lib/blog/mdx";
import type { MetadataRoute } from "next";

const domain = "https://msppentesting.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: domain,                        lastModified: new Date(), changeFrequency: "monthly",  priority: 1.0 },
    { url: `${domain}/blog`,              lastModified: new Date(), changeFrequency: "weekly",   priority: 0.9 },
    { url: `${domain}/login`,             lastModified: new Date(), changeFrequency: "yearly",   priority: 0.5 },
    { url: `${domain}/trust-safety`,      lastModified: new Date(), changeFrequency: "yearly",   priority: 0.4 },
    { url: `${domain}/support`,           lastModified: new Date(), changeFrequency: "yearly",   priority: 0.4 },
  ];

  const posts = getAllPosts(["slug", "date"]);
  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${domain}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...blogEntries];
}
