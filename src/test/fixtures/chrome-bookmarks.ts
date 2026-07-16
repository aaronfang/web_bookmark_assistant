export const mockChromeBookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    syncing: false,
    children: [
      {
        id: '1',
        parentId: '0',
        title: 'Bookmarks bar',
        syncing: false,
        children: [
          {
            id: '10',
            parentId: '1',
            title: 'Example',
            url: 'https://example.com/',
            syncing: false,
          },
          {
            id: '11',
            parentId: '1',
            title: 'Development',
            syncing: false,
            children: [
              {
                id: '12',
                parentId: '11',
                title: 'MDN',
                url: 'https://developer.mozilla.org/',
                syncing: false,
              },
            ],
          },
        ],
      },
    ],
  },
];
