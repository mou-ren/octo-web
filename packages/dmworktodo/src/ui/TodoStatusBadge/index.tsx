import React from 'react';
import type { TodoStatus } from '../../bridge/types';
import './index.css';

export interface TodoStatusBadgeProps {
  status: TodoStatus;
  className?: string;
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  open: '待处理',
  closed: '已完成',
};

export default function TodoStatusBadge({ status, className }: TodoStatusBadgeProps) {
  return (
    <span
      className={`wk-todo-status-badge wk-todo-status-badge--${status}${className ? ` ${className}` : ''}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export { TodoStatusBadge };
