// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const hipefitConfig = require('@hipefit/config/eslint');

module.exports = defineConfig([
  hipefitConfig,
  {
    // `.agents/**` holds vendored upstream agent skills (see skills-lock.json).
    // It is not app source: linting it reports third-party problems we cannot
    // fix, and the husky pre-commit hook (`lint:fix`) would silently rewrite
    // those vendored files on every commit.
    //
    // `docs/.obsidian/**` is the Obsidian vault config, mostly machine-written
    // and partly downloaded plugin bundles (see .gitignore) — same reasoning.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      'node_modules/**',
      '.agents/**',
      'docs/.obsidian/**',
    ],
  },
]);
