import React from 'react';
import { Channel, ChannelTypePerson } from 'wukongimjssdk';
import type { Todo, TodoStatus } from '../../bridge/types';
import WKAvatar from '@octo/base/src/Components/WKAvatar';
import './index.css';

export interface TodoCardProps {
  todo: Todo;
  goalTitle?: string;              // 项目名（由父组件查询后传入）
  channelName?: string;            // 来源频道名（由父组件传入）
  assigneeUids?: string[];         // 负责人 uid 列表（列表接口暂无，先留空数组）
  hideProject?: boolean;           // 项目内部视图不显示项目名，默认 false
  selected?: boolean;              // 是否选中（高亮）
  onClick?: (todoId: string) => void;         // 点击任务名展开详情
  onStatusChange?: (todoId: string, newStatus: TodoStatus) => void;  // checkbox 回调
  className?: string;
}

interface DeadlineInfo {
  text: string;
  className: string;
}

function formatDeadline(deadline: string): DeadlineInfo | null {
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 今天
  if (diffDays === 0) {
    return { text: '今天', className: 'wk-todo-card__deadline--today' };
  }

  // 逾期
  if (diffDays < 0) {
    return { text: `逾期${Math.abs(diffDays)}天`, className: 'wk-todo-card__deadline--overdue' };
  }

  // 其他：M/D 格式
  const month = deadlineDate.getMonth() + 1;
  const day = deadlineDate.getDate();
  return { text: `${month}/${day}`, className: '' };
}

export default function TodoCard({
  todo,
  goalTitle,
  channelName,
  assigneeUids = [],
  hideProject = false,
  selected = false,
  onClick,
  onStatusChange,
  className,
}: TodoCardProps) {
  const handleClick = () => {
    if (onClick) onClick(todo.id);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStatusChange) {
      const newStatus: TodoStatus = todo.status === 'open' ? 'closed' : 'open';
      onStatusChange(todo.id, newStatus);
    }
  };

  const handleCheckboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (onStatusChange) {
        const newStatus: TodoStatus = todo.status === 'open' ? 'closed' : 'open';
        onStatusChange(todo.id, newStatus);
      }
    }
  };

  const deadlineInfo = todo.deadline ? formatDeadline(todo.deadline) : null;
  const isClosed = todo.status === 'closed';

  // 构建 meta 行
  const metaParts: React.ReactNode[] = [];

  // 项目名
  if (goalTitle && !hideProject) {
    metaParts.push(
      <span key="goal" className="wk-todo-card__goal">
        📁{goalTitle}
      </span>
    );
  }

  // 来源频道
  if (channelName) {
    metaParts.push(
      <span key="channel" className="wk-todo-card__channel">
        #{channelName}
      </span>
    );
  }

  // 负责人头像
  if (assigneeUids.length > 0) {
    const displayUids = assigneeUids.slice(0, 3);
    const remainingCount = assigneeUids.length - 3;

    metaParts.push(
      <div key="assignees" className="wk-todo-card__assignees">
        {displayUids.map((uid) => (
          <WKAvatar
            key={uid}
            channel={new Channel(uid, ChannelTypePerson)}
            style={{ width: 16, height: 16, borderRadius: '50%' }}
          />
        ))}
        {remainingCount > 0 && (
          <span className="wk-todo-card__assignees-more">+{remainingCount}</span>
        )}
      </div>
    );
  }

  const showMetaRow = metaParts.length > 0;

  return (
    <div
      className={`wk-todo-card${selected ? ' wk-todo-card--selected' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
      }}
    >
      <div className="wk-todo-card__row-1">
        <div
          className={`wk-todo-card__checkbox${!onStatusChange ? ' wk-todo-card__checkbox--disabled' : ''}`}
          onClick={onStatusChange ? handleCheckboxClick : undefined}
          onKeyDown={onStatusChange ? handleCheckboxKeyDown : undefined}
          role="checkbox"
          aria-label={isClosed ? '标记为待处理' : '标记为已完成'}
          aria-checked={isClosed}
          aria-disabled={!onStatusChange}
          tabIndex={onStatusChange ? 0 : -1}
        >
          {isClosed && <span className="wk-todo-card__checkbox-check">✓</span>}
        </div>
        <div className={`wk-todo-card__title${isClosed ? ' wk-todo-card__title--closed' : ''}`}>
          {todo.title.replace(/@\[([^:]+):([^\]]+)\]/g, (_m, _uid, name) => `@${name}`)}
        </div>
        {deadlineInfo && (
          <div className={`wk-todo-card__deadline ${deadlineInfo.className}`.trim()}>
            {deadlineInfo.text}
          </div>
        )}
      </div>

      {showMetaRow && (
        <div className="wk-todo-card__row-2">
          {metaParts.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="wk-todo-card__separator">·</span>}
              {part}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export { TodoCard };
