import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/**/*.ts',
    'scripts/**/*.ts',
    'tests/**/*.ts',
  ],

  ignore: [
    'dist/**/*',
  ],

  ignoreDependencies: [
    'vitest',
  ],
};

export default config;