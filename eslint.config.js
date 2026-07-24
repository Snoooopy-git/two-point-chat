const js = require('@eslint/js');
const pluginVue = require('eslint-plugin-vue');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      'client/dist/**',
      'client/public/emoji-data.json',
      'server/uploads/**',
      'logs/**',
      'backups/**'
    ]
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node
    }
  },
  {
    files: ['client/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser
    },
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
];
