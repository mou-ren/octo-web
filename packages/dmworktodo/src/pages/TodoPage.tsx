import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WKApp } from '@octo/base';
import * as api from '../api/todoApi';
import type { Goal, GoalStatus, CreateGoalReq, Todo, TodoListParams } from '../bridge/types';
import { useTodoList } from '../hooks/useTodoList';
import { useGoalList } from '../hooks/useGoalList';
import TodoCard from '../ui/TodoCard';
import TodoFilterBar from '../ui/TodoFilterBar';
import DetailPanel from '../ui/DetailPanel';
import CreateTaskModal from '../ui/CreateTaskModal';
import { Toast } from '../utils/toast';
import './TodoPage.css';

// ─── 时间分组 ────────────────────────────────────────────

type TimeGroup = 'overdue' | 'today' | 'week' | 'later' | 'no-deadline' | 'done';

interface GroupedTodos {
  overdue: Todo[];
  today: Todo[];
  week: Todo[];
  later: Todo[];
  noDeadline: Todo[];
  done: Todo[];
}

function groupByTime(todos: Todo[]): GroupedTodos {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const result: GroupedTodos = { overdue: [], today: [], week: [], later: [], noDeadline: [], done: [] };

  for (const todo of todos) {
    if (todo.status === 'closed') {
      result.done.push(todo);
      continue;
    }
    if (!todo.deadline) {
      result.noDeadline.push(todo);
      continue;
    }
    const dl = new Date(todo.deadline);
    dl.setHours(0, 0, 0, 0);
    if (dl < todayStart) {
      result.overdue.push(todo);
    } else if (dl <= todayEnd) {
      result.today.push(todo);
    } else if (dl <= weekEnd) {
      result.week.push(todo);
    } else {
      result.later.push(todo);
    }
  }
  return result;
}

// ─── 导航视图类型 ────────────────────────────────────────

type NavView = 'mine' | 'created' | 'all' | string; // string = goalId

// 供 sidebar 的「新建任务」按钮调用当前 TodoListView 的 modal
let _openCreateModal: (() => void) | null = null;

// ─── Todo List View ─────────────────────────────────────

interface TodoListViewProps {
  navView: NavView;
  goalTitle?: string;
  onGoalsRefresh?: () => void;
}

const GROUP_CONFIG: Array<{ key: keyof GroupedTodos; label: string; icon: string }> = [
  { key: 'overdue',    label: '已逾期',    icon: '⚠️' },
  { key: 'today',      label: '今天到期',  icon: '📅' },
  { key: 'week',       label: '本周',      icon: '📆' },
  { key: 'later',      label: '之后',      icon: '🗓' },
  { key: 'noDeadline', label: '无截止日期', icon: '•' },
];

function buildParams(navView: NavView, myUid: string): TodoListParams {
  if (navView === 'mine') return { assignee_id: myUid };
  if (navView === 'created') return { creator_id: myUid };
  if (navView === 'all') return {};
  return { goal_id: navView }; // goalId
}

function TodoListView({ navView, goalTitle, onGoalsRefresh }: TodoListViewProps) {
  const myUid = WKApp.loginInfo.uid ?? '';
  const initialFilters = useMemo(() => buildParams(navView, myUid), [navView, myUid]);

  const { todos, loading, hasMore, filters, setFilters, reload, loadMore, toggleStatus } = useTodoList({ initialFilters });
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [doneExpanded, setDoneExpanded] = useState(false);

  useEffect(() => {
    _openCreateModal = () => { setShowCreateModal(true); };
    return () => { _openCreateModal = null; };
  }, []);

  // navView 切换时重置选中
  useEffect(() => {
    setSelectedTodoId(null);
  }, [navView]);

  const grouped = useMemo(() => groupByTime(todos), [todos]);

  const title = navView === 'mine' ? '我负责的'
    : navView === 'created' ? '我发起的'
    : navView === 'all' ? '全部任务'
    : goalTitle ?? '项目任务';

  const handleConfirmCreate = useCallback(async (req: Parameters<typeof api.createTodo>[0]) => {
    await api.createTodo(req);
    Toast.success('任务已创建');
    setShowCreateModal(false);
    reload();
    onGoalsRefresh?.();
  }, [reload, onGoalsRefresh]);

  const renderGroup = (key: keyof GroupedTodos, label: string, icon: string) => {
    const items = grouped[key];
    if (items.length === 0) return null;
    return (
      <div key={key} className="wk-todo-group">
        <div className="wk-todo-group__header">
          <span className="wk-todo-group__icon">{icon}</span>
          <span className="wk-todo-group__label">{label}</span>
          <span className="wk-todo-group__count">{items.length}</span>
        </div>
        {items.map((todo) => (
          <TodoCard
            key={todo.id}
            todo={todo}
            selected={selectedTodoId === todo.id}
            assigneeUids={[]}
            channelName={todo.source_name}
            hideProject={navView !== 'all' && navView !== 'mine' && navView !== 'created'}
            onClick={(id) => setSelectedTodoId(id)}
            onStatusChange={(id) => toggleStatus(id, todo.status)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="wk-todo-list-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="wk-todo-list-view__header">
        <span className="wk-todo-list-view__title">{title}</span>
        <TodoFilterBar filters={filters} onFilterChange={setFilters} searchOnly />
      </div>

      {/* Content: list + detail panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading && (
            <div className="wk-todo-list__loading">加载中...</div>
          )}
          {!loading && todos.length === 0 && (
            <div className="wk-todo-list__empty">暂无任务</div>
          )}

          {/* 时间分组 */}
          {!loading && GROUP_CONFIG.map(({ key, label, icon }) => renderGroup(key, label, icon))}

          {/* 已完成（折叠） */}
          {!loading && grouped.done.length > 0 && (
            <div className="wk-todo-group">
              <div
                className="wk-todo-group__section-header"
                onClick={() => setDoneExpanded((v) => !v)}
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10"
                  style={{ transform: doneExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms', flexShrink: 0 }}
                >
                  <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>已完成</span>
                <span style={{ marginLeft: '4px', opacity: 0.5 }}>({grouped.done.length})</span>
              </div>
              {doneExpanded && grouped.done.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  selected={selectedTodoId === todo.id}
                  assigneeUids={[]}
                  channelName={todo.source_name}
                  hideProject={navView !== 'all' && navView !== 'mine' && navView !== 'created'}
                  onClick={(id) => setSelectedTodoId(id)}
                  onStatusChange={(id) => toggleStatus(id, todo.status)}
                />
              ))}
            </div>
          )}

          {!loading && hasMore && (
            <button type="button" onClick={loadMore} className="wk-todo-load-more">
              加载更多
            </button>
          )}
        </div>

        {/* Detail panel */}
        {selectedTodoId && (
          <DetailPanel
            todoId={selectedTodoId}
            onClose={() => setSelectedTodoId(null)}
            onStatusChanged={() => { reload(); onGoalsRefresh?.(); }}
          />
        )}
      </div>

      <CreateTaskModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onDirtyClose={() => setShowCreateModal(false)}
        onConfirm={handleConfirmCreate}
      />
    </div>
  );
}

// ─── Goal Status Badge ──────────────────────────────────

function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const config: Record<GoalStatus, { label: string; color: string; bg: string; icon: string }> = {
    active:    { label: '进行中', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)',   icon: '●' },
    completed: { label: '已完成', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)',   icon: '✓' },
    archived:  { label: '已归档', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.08)', icon: '○' },
  };
  const resolved = config[status] || config.active;
  return (
    <span className="wk-goal-status-badge" style={{ color: resolved.color, background: resolved.bg }}>
      <span style={{ fontSize: '8px', lineHeight: 1 }}>{resolved.icon}</span> {resolved.label}
    </span>
  );
}

// ─── Goal Card ──────────────────────────────────────────

function GoalCard({ goal, selected, onClick }: { goal: Goal; selected: boolean; onClick: () => void }) {
  const totalTodos = goal.open_count + goal.closed_count;
  let isOverdue = false;
  let deadlineDisplay = '';
  if (goal.deadline) {
    const d = new Date(goal.deadline); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    isOverdue = goal.status === 'active' && d < today;
    deadlineDisplay = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  }
  return (
    <div className={`wk-goal-card${selected ? ' wk-goal-card--selected' : ''}`} onClick={onClick}>
      <div className="wk-goal-card__header">
        <span className="wk-goal-card__title">{goal.title}</span>
        <GoalStatusBadge status={goal.status} />
      </div>
      <div className="wk-goal-card__meta">
        {totalTodos > 0
          ? <span className="wk-goal-card__stats">{goal.open_count} 进行中 · {goal.closed_count} 已关闭</span>
          : <span className="wk-goal-card__stats">暂无任务</span>}
        {goal.deadline && (
          <span className={`wk-goal-card__deadline${isOverdue ? ' wk-goal-card__deadline--overdue' : ''}`}>
            {isOverdue ? '⚠ ' : ''}{deadlineDisplay}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── New Goal Dialog ────────────────────────────────────

function NewGoalDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (goal: Goal) => void }) {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const req: CreateGoalReq = { title: title.trim() };
      if (deadline) req.deadline = new Date(`${deadline}T00:00:00`).toISOString();
      onCreated(await api.createGoal(req));
    } catch { Toast.error('创建目标失败'); }
    finally { setCreating(false); }
  }, [title, deadline, creating, onCreated]);

  return (
    <div className="wk-todo-dialog-overlay" onClick={onClose}>
      <div className="wk-todo-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="wk-todo-dialog__title">新建目标</div>
        <input className="wk-todo-dialog__input" type="text" placeholder="目标名称..."
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
        <div style={{ marginTop: '8px' }}>
          <label className="wk-todo-dialog__label">截止日期（可选）</label>
          <input className="wk-todo-dialog__input" type="date" value={deadline}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="wk-todo-dialog__actions">
          <button type="button" className="wk-todo-dialog__btn wk-todo-dialog__btn--cancel" onClick={onClose}>取消</button>
          <button type="button" className="wk-todo-dialog__btn wk-todo-dialog__btn--create"
            onClick={handleCreate} disabled={!title.trim() || creating}>
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Icons ──────────────────────────────────────

function NavIcon({ type }: { type: 'mine' | 'created' | 'all' }) {
  if (type === 'mine') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
  if (type === 'created') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

// ─── TodoPage (Main Export) ─────────────────────────────

const TOP_NAV: Array<{ id: NavView; label: string; icon: 'mine' | 'created' | 'all' }> = [
  { id: 'mine',    label: '我负责的', icon: 'mine' },
  { id: 'created', label: '我发起的', icon: 'created' },
  { id: 'all',     label: '全部任务', icon: 'all' },
];

export default function TodoPage() {
  const { goals, reload: reloadGoals } = useGoalList();
  const [selectedView, setSelectedView] = useState<NavView>('mine');
  const [showNewGoal, setShowNewGoal] = useState(false);

  const navigate = useCallback((view: NavView, goalTitle?: string) => {
    setSelectedView(view);
    WKApp.routeRight.replaceToRoot(
      // key={view} 保证切换视图时组件重新挂载，hook 内部 filters state 重置
      <TodoListView key={view} navView={view} goalTitle={goalTitle} onGoalsRefresh={reloadGoals} />
    );
  }, [reloadGoals]);

  // 初始化
  useEffect(() => {
    navigate('mine');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // space 切换重置
  useEffect(() => {
    const handler = () => {
      reloadGoals();
      navigate('mine');
    };
    WKApp.mittBus.on('space-changed', handler);
    return () => { WKApp.mittBus.off('space-changed', handler); };
  }, [reloadGoals, navigate]);

  const handleGoalCreated = useCallback((goal: Goal) => {
    setShowNewGoal(false);
    reloadGoals();
    navigate(goal.id, goal.title);
  }, [reloadGoals, navigate]);

  return (
    <div className="wk-todo-sidebar">
      {/* 新建任务 */}
      <div className="wk-todo-sidebar__create">
        <button
          type="button"
          className="wk-todo-sidebar__create-btn"
          onClick={() => _openCreateModal?.()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新建任务
        </button>
      </div>

      {/* 顶部固定导航 */}
      {TOP_NAV.map(({ id, label, icon }) => (
        <div
          key={id}
          className={`wk-todo-sidebar__item${selectedView === id ? ' wk-todo-sidebar__item--selected' : ''}`}
          onClick={() => navigate(id)}
        >
          <div className="wk-todo-sidebar__item-icon"><NavIcon type={icon} /></div>
          <span className="wk-todo-sidebar__item-name">{label}</span>
        </div>
      ))}

      {/* 项目分区 */}
      <div className="wk-todo-sidebar__section-header">
        <span className="wk-todo-sidebar__section">项目</span>
        <button type="button" className="wk-todo-sidebar__add-btn" onClick={() => setShowNewGoal(true)} title="新建项目">
          <PlusIcon />
        </button>
      </div>

      <div className="wk-todo-sidebar__list">
        {goals.length === 0 ? (
          <div className="wk-todo-sidebar__empty">暂无项目</div>
        ) : (
          goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              selected={selectedView === g.id}
              onClick={() => navigate(g.id, g.title)}
            />
          ))
        )}
      </div>

      {showNewGoal && (
        <NewGoalDialog onClose={() => setShowNewGoal(false)} onCreated={handleGoalCreated} />
      )}
    </div>
  );
}

export { TodoPage };
