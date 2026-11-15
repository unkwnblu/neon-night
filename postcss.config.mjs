// Tailwind runs through PostCSS, the setup the Next.js docs describe. It works
// with both of Next's bundlers, which the Turbopack-only loader did not.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
