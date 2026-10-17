import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Les écrans chargent leurs données côté client après authentification :
    // on ne valide l'« instant navigation » que sur les segments qui la demandent.
    instantInsights: { validationLevel: "manual-warning" },
  },
};

export default nextConfig;
