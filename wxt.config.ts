import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Web Bookmark Assistant',
    description: '本地优先的 Chrome 书签检索、分类和回顾助手',
    version: '0.1.0',
    permissions: ['bookmarks', 'sidePanel'],
    action: {
      default_title: 'Web Bookmark Assistant',
    },
  },
});
