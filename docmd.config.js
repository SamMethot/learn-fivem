export default defineConfig({
  title: 'FiveM School',
  url: 'https://sammethot.github.io/learn-fivem',
  src: '.',
  minify: true,
  autoTitleFromH1: true,
  copyCode: true,
  pageNavigation: true,

  layout: {},

  navigation: [
    { title: 'Home', path: './index', icon: 'house' },
    { title: 'Full Index', path: './FULL-INDEX', icon: 'list' },

    {
      title: 'Basics',
      icon: 'book-open',
      children: [
        { title: 'What Is FiveM?', path: '/01-basics/01-what-is-fivem' },
        { title: 'Lua Crash Course', path: '/01-basics/02-lua-crash-course' },
        { title: 'Client vs Server', path: '/01-basics/03-client-vs-server' },
        { title: 'Resources & fxmanifest', path: '/01-basics/04-resources-and-fxmanifest' },
      ],
    },

    {
      title: 'Events',
      icon: 'radio',
      children: [
        { title: 'Local Events', path: '/02-events/01-local-events' },
        { title: 'Network Events', path: '/02-events/02-net-events' },
        { title: 'Event Security', path: '/02-events/03-event-security' },
        { title: 'Callbacks', path: '/02-events/04-callbacks' },
      ],
    },

    {
      title: 'Natives',
      icon: 'cpu',
      children: [
        { title: 'What Are Natives?', path: '/03-natives/01-what-are-natives' },
        { title: 'Common Natives', path: '/03-natives/02-common-natives' },
      ],
    },

    {
      title: 'Database',
      icon: 'database',
      children: [
        { title: 'oxmysql Basics', path: '/04-database/01-oxmysql-basics' },
        { title: 'Queries & Security', path: '/04-database/02-queries-and-security' },
      ],
    },

    {
      title: 'Frameworks',
      icon: 'layers',
      children: [
        { title: 'QBox Basics', path: '/05-frameworks/01-qbox-basics' },
        { title: 'ESX Basics', path: '/05-frameworks/02-esx-basics' },
        { title: 'QBCore Basics', path: '/05-frameworks/03-qbcore-basics' },
      ],
    },

    {
      title: 'ox Libraries',
      icon: 'package',
      children: [
        { title: 'ox_lib', path: '/06-ox-libraries/01-ox-lib' },
        { title: 'ox_target', path: '/06-ox-libraries/02-ox-target' },
        { title: 'Inventories', path: '/06-ox-libraries/03-inventories' },
      ],
    },

    {
      title: 'NUI (HTML UI)',
      icon: 'monitor',
      children: [
        { title: 'NUI Basics', path: '/07-nui/01-nui-basics' },
        { title: 'React NUI', path: '/07-nui/02-react-nui' },
      ],
    },

    {
      title: 'Security',
      icon: 'shield',
      children: [
        { title: 'Security Checklist', path: '/08-security/01-security-checklist' },
      ],
    },

    {
      title: 'Performance',
      icon: 'gauge',
      children: [
        { title: 'Threads & Waits', path: '/09-performance/01-threads-and-waits' },
        { title: 'Optimization Patterns', path: '/09-performance/02-optimization-patterns' },
      ],
    },

    {
      title: 'First Projects',
      icon: 'rocket',
      children: [
        { title: 'Hello Resource', path: '/10-first-projects/01-hello-resource' },
        { title: 'Shop', path: '/10-first-projects/02-shop' },
        { title: 'NUI Menu', path: '/10-first-projects/03-nui-menu' },
      ],
    },
  ],

   theme: {
    name: 'default',
    appearance: 'dark', // Options: 'light', 'dark', 'system'
  },

   plugins: {
    git: {
      repo: 'https://github.com/SamMethot/learn-fivem',
      branch: 'main',
      editLink: true,
      lastUpdated: true,
      commitHistory: true,
      maxCommits: 5
    }
  },

  footer: {
    style: 'minimal', // 'minimal' or 'complete'
    copyright: '© 2026 learn-fivem. All rights reserved.',
    description: 'Documentation built with docmd.',
  },

  
});
