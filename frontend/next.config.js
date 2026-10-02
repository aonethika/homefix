const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** Keep development output separate from production builds. */
module.exports = (phase) => ({
  distDir: process.env.NEXT_BUILD_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
  images: { remotePatterns: [] },
});
