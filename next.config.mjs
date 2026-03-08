/** @type {import('next').NextConfig} */
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.ctfassets.net" },
      { hostname: "cdn.prod.website-files.com" },
    ],
  },
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default withMDX(nextConfig);
