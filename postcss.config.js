// PostCSS Configuration with PurgeCSS
// This optimizes CSS by removing unused styles

const purgecss = require('@fullhuman/postcss-purgecss').default;

module.exports = (ctx) => ({
  plugins: [
    // Autoprefixer - adds vendor prefixes
    require('autoprefixer'),

    // PurgeCSS - removes unused CSS (only in production)
    ...(ctx.env === 'production' ? [
      purgecss({
        // Content files to scan for used CSS classes
        content: [
          './frontend/public/**/*.html',
          './frontend/public/**/*.js',
          './frontend/public/partials/**/*.html'
        ],

        // Safelist - classes to keep even if not found
        safelist: {
          // Standard safelist for always-keep classes
          standard: [
            // Bootstrap utilities
            /^btn/,
            /^alert/,
            /^badge/,
            /^text-/,
            /^bg-/,
            /^border/,
            /^navbar/,
            /^dropdown/,
            /^modal/,
            /^carousel/,
            /^tooltip/,
            /^popover/,
            /^collapse/,
            /^fade/,
            /^show/,
            /^active/,
            /^disabled/,
            /^form-/,
            /^input/,
            /^is-invalid/,
            /^is-valid/,
            /^was-validated/,
            // Common states
            'selected',
            'highlighted',
            'error',
            'success',
            'warning',
            'info',
            // Font Awesome
            /^fa-/,
            /^fas/,
            /^far/,
            /^fab/,
            // App-specific
            /^product/,
            /^seller/,
            /^notification/,
            /^message/,
            /^cart/,
            /^header/,
            /^footer/,
            /^category/,
            /^listing/
          ],

          // Deep safelist - keeps class and all descendants
          deep: [],

          // Greedy safelist - keeps class and all variants
          greedy: [
            /^spinner/,
            /^bs-/
          ]
        },

        // Default extractor for HTML and JS
        defaultExtractor: content => {
          // Broad matching for Bootstrap and custom classes
          const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
          // Special pattern for classes in strings
          const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
          return broadMatches.concat(innerMatches);
        }
      })
    ] : []),

    // CSSnano - minifies CSS (only in production)
    ...(ctx.env === 'production' ? [
      require('cssnano')({
        preset: ['default', {
          discardComments: {
            removeAll: true
          }
        }]
      })
    ] : [])
  ]
});