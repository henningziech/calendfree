import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';

const config: Config = {
  title: 'Calendfree',
  tagline: 'Round-Robin Scheduling Platform',
  favicon: 'img/favicon.ico',
  url: 'https://docs.calendfree.de',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    ['classic', {
      docs: {
        sidebarPath: './sidebars.ts',
        docItemComponent: '@theme/ApiItem',
        routeBasePath: '/',
      },
      theme: { customCss: './src/css/custom.css' },
    }],
  ],

  plugins: [
    function polyfillPlugin() {
      return {
        name: 'path-polyfill',
        configureWebpack() {
          return {
            resolve: {
              fallback: {
                path: require.resolve('path-browserify'),
              },
            },
          };
        },
      };
    },
    ['docusaurus-plugin-openapi-docs', {
      id: 'api',
      docsPluginId: 'classic',
      config: {
        calendfree: {
          specPath: 'openapi/calendfree.json',
          outputDir: 'docs/api',
          sidebarOptions: { groupPathsBy: 'tag' },
        } satisfies OpenApiPlugin.Options,
      },
    }],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  themeConfig: {
    navbar: {
      title: 'Calendfree',
      logo: { alt: 'Calendfree', src: 'img/logo-mini.png' },
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs', position: 'left' },
        // TODO: Uncomment after API docs are generated
        // { type: 'docSidebar', sidebarId: 'api', label: 'API Reference', position: 'left' },
      ],
    },
    footer: {
      style: 'dark',
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} Calendfree`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    colorMode: {
      defaultMode: 'light',
    },
  },
};

export default config;
