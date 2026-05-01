import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as api from '../api/todoApi';
import type { Todo, TodoListParams, TodoStatus } from '../bridge/types';
import { Toast } from '../utils/toast';

export interface UseTodoListOptions {
  goalId?: string;
  initialFilters?: TodoListParams;
  pageSize?: number;
}

export interface UseTodoListResult {
  todos: Todo[];
  loading: boolean;
  hasMore: boolean;
  filters: TodoListParams;
  setFilters: (patch: Partial<TodoListParams>) => void;
  reload: () => void;
  loadMore: () => void;
  toggleStatus: (todoId: string, currentStatus: TodoStatus) => Promise<void>;
  optimisticUpdate: (todoId: string, patch: Partial<Todo>) => void;
  addOptimistic: (todo: Todo) => void;
  removeOptimistic: (todoId: string) => void;
}

export function useTodoList({
  goalId,
  initialFilters = {},
  pageSize = 50,
}: UseTodoListOptions = {}): UseTodoListResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFiltersState] = useState<TodoListParams>(initialFilters);
  const cursorRef = useRef<string | undefined>();

  // 当 initialFilters 引用变化时（如 channel 切换）同步重置 filters
  const initialFiltersKey = useMemo(() => JSON.stringify(initialFilters), [initialFilters]);
  useEffect(() => {
    setFiltersState(initialFilters);
    cursorRef.current = undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiltersKey]);

  // Stable string for useCallback deps — avoids recreating `load` on every render
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    try {
      const params: TodoListParams = { ...filters, limit: pageSize };
      if (goalId) params.goal_id = goalId;
      if (append && cursorRef.current) params.cursor = cursorRef.current;

      const res = await api.listTodos(params);
      setTodos(append ? (prev) => [...prev, ...res.data] : res.data);
      setHasMore(res.pagination.has_more);
      cursorRef.current = res.pagination.next_cursor;
    } catch {
      Toast.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, filtersKey, pageSize]);

  useEffect(() => {
    cursorRef.current = undefined;
    load(false);
  }, [load]);

  const setFilters = useCallback((patch: Partial<TodoListParams>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reload = useCallback(() => {
    cursorRef.current = undefined;
    load(false);
  }, [load]);

  const loadMore = useCallback(() => {
    load(true);
  }, [load]);

  const toggleStatus = useCallback(async (todoId: string, currentStatus: TodoStatus) => {
    const newStatus: TodoStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await api.transitionTodo(todoId, newStatus);
      setTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, status: newStatus } : t))
      );
    } catch {
      Toast.error('更新状态失败');
    }
  }, []);

  const optimisticUpdate = useCallback((todoId: string, patch: Partial<Todo>) => {
    setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, ...patch } : t)));
  }, []);

  const addOptimistic = useCallback((todo: Todo) => {
    setTodos((prev) => [todo, ...prev]);
  }, []);

  /** 移除乐观条目：精确匹配 id，或前缀匹配（传入前缀字符串） */
  const removeOptimistic = useCallback((todoIdOrPrefix: string) => {
    setTodos((prev) => prev.filter((t) => !t.id.startsWith(todoIdOrPrefix) && t.id !== todoIdOrPrefix));
  }, []);

  return { todos, loading, hasMore, filters, setFilters, reload, loadMore, toggleStatus, optimisticUpdate, addOptimistic, removeOptimistic };
}
