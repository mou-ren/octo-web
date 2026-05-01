import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { TodoListParams, TodoStatus } from '../../bridge/types';
import './index.css';

export interface TodoFilterBarProps {
  filters: TodoListParams;
  onFilterChange: (filters: Partial<TodoListParams>) => void;
  searchOnly?: boolean;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部' },
  { value: 'open', label: '待处理' },
  { value: 'closed', label: '已完成' },
];

export default function TodoFilterBar({ filters, onFilterChange, searchOnly = false }: TodoFilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.q || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external filter changes back to local state
  useEffect(() => {
    setLocalSearch(filters.q || '');
  }, [filters.q]);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onFilterChange({ status: (value || undefined) as TodoStatus | undefined });
    },
    [onFilterChange],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFilterChange({ q: value || undefined });
      }, 300);
    },
    [onFilterChange],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="wk-todo-filter-bar">
      {!searchOnly && (
        <select
          className="wk-todo-filter-bar__select"
          value={filters.status || ''}
          onChange={handleStatusChange}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      <input
        className="wk-todo-filter-bar__search"
        type="text"
        placeholder="搜索任务..."
        value={localSearch}
        onChange={handleSearchChange}
      />
    </div>
  );
}

export { TodoFilterBar };
