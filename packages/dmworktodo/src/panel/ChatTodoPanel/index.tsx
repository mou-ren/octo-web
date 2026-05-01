import React, { useState, useCallback } from 'react';
import type { Todo } from '../../bridge/types';
import { useTodoList } from '../../hooks/useTodoList';
import TodoCard from '../../ui/TodoCard';
import DetailPanel from '../../ui/DetailPanel';
import QuickAddBar from '../../ui/QuickAddBar';
import './index.css';

export interface ChatTodoPanelProps {
  channelId: string;
  channelType: number;
  channelName?: string;
  onClose: () => void;
}

type Tab = 'open' | 'closed';

/**
 * ChatTodoPanel — 频道侧边任务面板（M4 重构）
 * - 两个 Tab：待处理 / 已完成
 * - 点击卡片展开 DetailPanel（原地替换列表）
 * - 底部 QuickAddBar：Enter 乐观创建，⊕ 展开完整 Modal
 */
export default function ChatTodoPanel({
  channelId,
  channelType,
  channelName,
  onClose,
}: ChatTodoPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('open');
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  const { todos, loading, reload, toggleStatus, addOptimistic, removeOptimistic } = useTodoList({
    initialFilters: {
      source_channel_id: channelId,
      source_channel_type: channelType,
    },
    pageSize: 100,
  });

  const openTodos = todos.filter((t) => t.status === 'open');
  const closedTodos = todos.filter((t) => t.status === 'closed');
  const displayTodos = activeTab === 'open' ? openTodos : closedTodos;

  const handleQuickCreated = useCallback((todo: Todo) => {
    if (todo.id.startsWith('__rollback__')) {
      // 回滚：移除乐观条目，reload 拿真实数据
      removeOptimistic(todo.id.replace('__rollback__', '__optimistic__'));
      reload();
      return;
    }
    if (todo.id.startsWith('__optimistic__')) {
      // 乐观插入：立即显示在列表顶部
      addOptimistic(todo);
      return;
    }
    // 真实数据回来：移除所有乐观条目（每次只有一个），reload 拿真实列表
    removeOptimistic('__optimistic__');
    reload();
  }, [reload, addOptimistic, removeOptimistic]);

  const channel = { channelId, channelType, name: channelName };

  return (
    <div className="wk-todo-chat-panel">
      {/* Header — 详情页时隐藏，由 DetailPanel 自己的 header 接管 */}
      {!selectedTodoId && (
        <div className="wk-todo-chat-panel__header">
          <span className="wk-todo-chat-panel__title">任务</span>
          <button type="button" className="wk-todo-chat-panel__close" onClick={onClose}>✕</button>
        </div>
      )}

      {/* Tabs — 详情页时隐藏 */}
      <div className="wk-todo-chat-panel__tabs" style={selectedTodoId ? { display: 'none' } : undefined}>
        <button
          type="button"
          className={`wk-todo-chat-panel__tab${activeTab === 'open' ? ' wk-todo-chat-panel__tab--active' : ''}`}
          onClick={() => { setActiveTab('open'); setSelectedTodoId(null); }}
        >
          待处理 <span className="wk-todo-chat-panel__tab-count">{openTodos.length}</span>
        </button>
        <button
          type="button"
          className={`wk-todo-chat-panel__tab${activeTab === 'closed' ? ' wk-todo-chat-panel__tab--active' : ''}`}
          onClick={() => { setActiveTab('closed'); setSelectedTodoId(null); }}
        >
          已完成 <span className="wk-todo-chat-panel__tab-count">{closedTodos.length}</span>
        </button>
      </div>

      {/* Body: list or detail */}
      <div className="wk-todo-chat-panel__body">
        {selectedTodoId ? (
          <DetailPanel
            todoId={selectedTodoId}
            channel={channel}
            onClose={() => setSelectedTodoId(null)}
            onStatusChanged={reload}
            showBack
          />
        ) : (
          <>
            {loading && <div className="wk-todo-chat-panel__empty">加载中...</div>}
            {!loading && displayTodos.length === 0 && (
              <div className="wk-todo-chat-panel__empty">
                {activeTab === 'open' ? '暂无待处理任务' : '暂无已完成任务'}
              </div>
            )}
            {!loading && displayTodos.map((todo) => (
              <div key={todo.id} style={{ marginBottom: 'var(--wk-sp-1, 4px)' }}>
                <TodoCard
                  todo={todo}
                  assigneeUids={[]}
                  hideProject
                  onClick={(id) => setSelectedTodoId(id)}
                  onStatusChange={(id) => toggleStatus(id, todo.status)}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Quick add footer */}
      <QuickAddBar
        channelId={channelId}
        channelType={channelType}
        channelName={channelName}
        onCreated={handleQuickCreated}
      />
    </div>
  );
}

export { ChatTodoPanel };
