/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off on purpose: every page reads live data from SQLite on each request (simpler for a hackathon).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
