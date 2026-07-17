import { useEffect, useState, type ReactNode } from 'react';

import { BookmarkFolderBrowser } from './BookmarkFolderBrowser';
import { BookmarkHealthCheck } from './BookmarkHealthCheck';
import { DuplicateBookmarkDetector } from './DuplicateBookmarkDetector';
import { FolderMoveSuggestions } from './FolderMoveSuggestions';
import { SnapshotExport } from './SnapshotExport';
import { OperationHistory } from './OperationHistory';

type DashboardSection =
  | 'overview'
  | 'folders'
  | 'duplicates'
  | 'health'
  | 'suggestions'
  | 'history'
  | 'backup';

interface OptionsDashboardProps {
  stats: {
    chromeBookmarks: number;
    chromeFolders: number;
    independentBookmarks: number;
  };
  revision: number;
}

const validSections = new Set<DashboardSection>([
  'overview',
  'folders',
  'duplicates',
  'health',
  'suggestions',
  'history',
  'backup',
]);

function sectionFromHash(hash: string): DashboardSection {
  const section = hash.replace(/^#/, '') as DashboardSection;
  return validSections.has(section) ? section : 'overview';
}

interface NavigationItem {
  id: DashboardSection;
  label: string;
}

const navigationGroups: Array<{
  label: string;
  items: NavigationItem[];
}> = [
  { label: '管理', items: [{ id: 'overview', label: '概览' }] },
  { label: '浏览', items: [{ id: 'folders', label: '文件夹' }] },
  {
    label: '诊断',
    items: [
      { id: 'duplicates', label: '重复检测' },
      { id: 'health', label: '健康检查' },
    ],
  },
  {
    label: '整理',
    items: [
      { id: 'suggestions', label: '整理建议' },
      { id: 'history', label: '操作历史' },
    ],
  },
  {
    label: '数据',
    items: [{ id: 'backup', label: '备份与恢复' }],
  },
];

function DashboardOverview({ stats }: Pick<OptionsDashboardProps, 'stats'>) {
  return (
    <section className="dashboard-overview" aria-labelledby="overview-title">
      <header className="dashboard-overview__header">
        <h2 id="overview-title">管理概览</h2>
        <p>查看本地索引状态，并从左侧进入低频管理工具。</p>
      </header>

      <section className="stats" aria-label="书签概况">
        <article>
          <strong>{stats.chromeBookmarks}</strong>
          <span>Chrome 书签</span>
        </article>
        <article>
          <strong>{stats.chromeFolders}</strong>
          <span>Chrome 文件夹</span>
        </article>
        <article>
          <strong>{stats.independentBookmarks}</strong>
          <span>独立书签</span>
        </article>
      </section>

      <section className="notice">
        <h2>安全基线已启用</h2>
        <p>
          当前版本只读取并建立本地索引；诊断和整理建议均为预览，不会修改 Chrome
          书签。
        </p>
        <ul className="permission-list">
          <li>
            <strong>书签</strong>：用于读取书签树和监听变化。
          </li>
          <li>
            <strong>侧边栏</strong>：用于从工具栏打开日常搜索界面。
          </li>
        </ul>
      </section>
    </section>
  );
}

export function OptionsDashboard({ stats, revision }: OptionsDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>(() =>
    sectionFromHash(window.location.hash),
  );

  useEffect(() => {
    const handleHashChange = (): void => {
      setActiveSection(sectionFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  let panel: ReactNode;
  switch (activeSection) {
    case 'folders':
      panel = <BookmarkFolderBrowser revision={revision} />;
      break;
    case 'duplicates':
      panel = <DuplicateBookmarkDetector revision={revision} />;
      break;
    case 'health':
      panel = <BookmarkHealthCheck revision={revision} />;
      break;
    case 'suggestions':
      panel = <FolderMoveSuggestions revision={revision} />;
      break;
    case 'history':
      panel = <OperationHistory revision={revision} />;
      break;
    case 'backup':
      panel = <SnapshotExport />;
      break;
    default:
      panel = <DashboardOverview stats={stats} />;
  }

  return (
    <section className="options-dashboard">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__title">管理中心</div>
        <nav aria-label="管理功能">
          {navigationGroups.map((group) => (
            <div className="dashboard-nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <a
                  aria-current={activeSection === item.id ? 'page' : undefined}
                  href={`#${item.id}`}
                  key={item.id}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="options-dashboard__panel" key={activeSection}>
        {panel}
      </div>
    </section>
  );
}
