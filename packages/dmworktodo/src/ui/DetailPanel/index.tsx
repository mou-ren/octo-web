import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import { WKApp, isSafeUrl } from '@octo/base';
import { Channel } from 'wukongimjssdk';
import * as api from '../../api/todoApi';
import type { TodoDetail, Goal, TodoComment, TodoAttachment } from '../../bridge/types';
import TodoStatusBadge from '../TodoStatusBadge';
import MemberPicker from '../MemberPicker';
import UserName from '../UserName';
import { Toast } from '../../utils/toast';
import './index.css';

// ─── Props 接口 ───────────────────────────────────────────

export interface DetailPanelProps {
  todoId: string;
  onClose?: () => void;
  /** 关闭按钮显示为返回箭头（在 ChatTodoPanel 侧边详情页中使用） */
  showBack?: boolean;
  onStatusChanged?: () => void;
  channel?: { channelId: string; channelType: number };
}

// ─── DetailPanel 主组件 ────────────────────────────────────

export default function DetailPanel({ todoId, onClose, onStatusChanged, channel, showBack }: DetailPanelProps) {
  const [todo, setTodo] = useState<TodoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<TodoComment[]>([]);
  const [attachments, setAttachments] = useState<TodoAttachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attachSubmitting, setAttachSubmitting] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [updatingGoal, setUpdatingGoal] = useState(false);
  const updatingGoalRef = useRef(false);

  // ─── 编辑任务名状态 ─────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [updatingTitle, setUpdatingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, a, g] = await Promise.all([
        api.getTodo(todoId),
        api.listComments(todoId),
        api.listAttachments(todoId),
        api.listGoals(),
      ]);
      setTodo(t);
      setComments(Array.isArray(c) ? c : []);
      setAttachments(Array.isArray(a) ? a : []);
      setGoals(Array.isArray(g) ? g : []);
    } catch (e) {
      Toast.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  }, [todoId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── 编辑任务名：进入编辑模式时自动聚焦 ───────────────
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // ─── 切换任务状态 ──────────────────────────────────────
  const handleToggleStatus = useCallback(async () => {
    if (!todo) return;
    const oldStatus = todo.status;
    const newStatus = oldStatus === 'open' ? 'closed' : 'open';
    // 乐观更新
    setTodo((prev) => prev ? { ...prev, status: newStatus } : prev);
    try {
      await api.transitionTodo(todo.id, newStatus);
      onStatusChanged?.();
    } catch (e) {
      // 回滚到旧状态
      setTodo((prev) => prev ? { ...prev, status: oldStatus } : prev);
      Toast.error('更新状态失败');
    }
  }, [todo, onStatusChanged]);

  // ─── 开始编辑任务名 ────────────────────────────────────
  const handleStartEditTitle = useCallback(() => {
    if (!todo) return;
    setEditTitleValue(todo.title);
    setIsEditingTitle(true);
  }, [todo]);

  // ─── 保存任务名 ────────────────────────────────────────
  const handleSaveTitle = useCallback(async () => {
    if (!todo || updatingTitle) return;
    const newTitle = editTitleValue.trim();
    if (!newTitle || newTitle === todo.title) {
      setIsEditingTitle(false);
      return;
    }
    setUpdatingTitle(true);
    try {
      const updated = await api.updateTodo(todoId, { title: newTitle });
      setTodo(updated);
      setIsEditingTitle(false);
      onStatusChanged?.();
    } catch (e) {
      Toast.error('更新标题失败');
    } finally {
      setUpdatingTitle(false);
    }
  }, [todo, editTitleValue, todoId, updatingTitle, onStatusChanged]);

  // ─── 添加评论 ──────────────────────────────────────────
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.addComment(todoId, newComment.trim());
      setNewComment('');
      const c = await api.listComments(todoId);
      setComments(Array.isArray(c) ? c : []);
    } catch (e) {
      Toast.error('添加评论失败');
    } finally {
      setSubmitting(false);
    }
  }, [todoId, newComment, submitting]);

  // ─── 删除评论 ──────────────────────────────────────────
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!window.confirm('Delete this comment?')) return;
      try {
        await api.deleteComment(todoId, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch (e) {
        Toast.error('删除评论失败');
      }
    },
    [todoId]
  );

  // ─── 添加附件 ──────────────────────────────────────────
  const handleAddAttachment = useCallback(async () => {
    if (!attachUrl.trim() || attachSubmitting) return;
    if (!isSafeUrl(attachUrl.trim())) {
      Toast.error('链接格式不正确，仅支持 http/https');
      return;
    }
    setAttachSubmitting(true);
    try {
      await api.createAttachment(todoId, attachUrl.trim(), attachName.trim() || undefined);
      setAttachUrl('');
      setAttachName('');
      setShowAttachForm(false);
      const a = await api.listAttachments(todoId);
      setAttachments(Array.isArray(a) ? a : []);
    } catch (e) {
      Toast.error('添加附件失败');
    } finally {
      setAttachSubmitting(false);
    }
  }, [todoId, attachUrl, attachName, attachSubmitting]);

  // ─── 删除附件 ──────────────────────────────────────────
  const handleDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (!window.confirm('Delete this attachment?')) return;
      try {
        await api.deleteAttachment(todoId, attachmentId);
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      } catch (e) {
        Toast.error('删除附件失败');
      }
    },
    [todoId]
  );

  // ─── 更新所属项目 ──────────────────────────────────────
  const handleGoalChange = useCallback(
    async (goalId: string) => {
      // 原子性检查+设置，防止竞态
      if (updatingGoalRef.current) return;
      updatingGoalRef.current = true; // 立即设置，后续异步操作不会重入
      setUpdatingGoal(true);
      try {
        const updated = await api.updateTodo(todoId, {
          goal_id: goalId || null,
        });
        setTodo(updated);
        onStatusChanged?.();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        Toast.error(`Failed to update goal: ${msg}`);
      } finally {
        updatingGoalRef.current = false;
        setUpdatingGoal(false);
      }
    },
    [todoId, onStatusChanged]
  );

  // ─── 更新截止日期 ──────────────────────────────────────
  const handleDeadlineChange = useCallback(
    async (deadline: string) => {
      if (!todo) return;
      try {
        const updated = await api.updateTodo(todoId, {
          deadline: deadline || null,
        });
        setTodo(updated);
        onStatusChanged?.();
      } catch (e) {
        Toast.error('更新截止日期失败');
      }
    },
    [todo, todoId, onStatusChanged]
  );

  // ─── 更新提醒时间 ──────────────────────────────────────
  const [remindMode, setRemindMode] = useState<'none' | '1h' | '1d' | 'custom'>('none');
  const [customRemindTime, setCustomRemindTime] = useState('');

  // 初始化 remindMode
  useEffect(() => {
    if (!todo) return;
    if (!todo.remind_at) {
      setRemindMode('none');
      return;
    }
    // 根据 remind_at 和 deadline 判断模式
    if (todo.deadline) {
      const remindTime = new Date(todo.remind_at).getTime();
      const deadlineTime = new Date(todo.deadline).getTime();
      const diff = deadlineTime - remindTime;
      if (Math.abs(diff - 3600000) < 60000) {
        setRemindMode('1h');
      } else if (Math.abs(diff - 86400000) < 60000) {
        setRemindMode('1d');
      } else {
        setRemindMode('custom');
        setCustomRemindTime(new Date(todo.remind_at).toISOString().slice(0, 16));
      }
    } else {
      setRemindMode('custom');
      setCustomRemindTime(new Date(todo.remind_at).toISOString().slice(0, 16));
    }
  // 只依赖 remind_at 和 deadline，避免 setTodo 产生新引用时反复重置 remindMode
  }, [todo?.remind_at, todo?.deadline]);

  const handleRemindModeChange = useCallback(
    async (mode: 'none' | '1h' | '1d' | 'custom') => {
      if (!todo) return;
      setRemindMode(mode);

      let remindAt: string | null = null;
      if (mode === 'none') {
        remindAt = null;
      } else if (mode === '1h' && todo.deadline) {
        const deadlineTime = new Date(todo.deadline).getTime();
        remindAt = new Date(deadlineTime - 3600000).toISOString();
      } else if (mode === '1d' && todo.deadline) {
        const deadlineTime = new Date(todo.deadline).getTime();
        remindAt = new Date(deadlineTime - 86400000).toISOString();
      } else if (mode === 'custom') {
        // 切换到自定义时先清空 remind_at，避免 UI 显示「自定义」但后端仍是旧值
        // 用户在 datetime-local 输入并 blur 后，handleCustomRemindTimeChange 会写入具体时间
        remindAt = null;
      }

      try {
        const updated = await api.updateTodo(todoId, { remind_at: remindAt });
        setTodo(updated);
        onStatusChanged?.();
      } catch (e) {
        Toast.error('更新提醒时间失败');
      }
    },
    [todo, todoId, onStatusChanged]
  );

  const handleCustomRemindTimeChange = useCallback(
    async (datetime: string) => {
      if (!datetime) return;
      try {
        const remindAt = new Date(datetime).toISOString();
        const updated = await api.updateTodo(todoId, { remind_at: remindAt });
        setTodo(updated);
        setCustomRemindTime(datetime);
        onStatusChanged?.();
      } catch (e) {
        Toast.error('更新提醒时间失败');
      }
    },
    [todoId, onStatusChanged]
  );

  // ─── 跳转到来源频道 ────────────────────────────────────
  const handleJumpToChannel = useCallback(() => {
    if (!todo?.source_channel_id || !todo?.source_channel_type) return;
    WKApp.endpoints.showConversation(new Channel(todo.source_channel_id, todo.source_channel_type));
  }, [todo]);

  return (
    <div className="wk-todo-side-panel">
      <div className="wk-todo-side-panel__header">
        {showBack ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#666', fontSize: '13px', padding: '2px 4px',
              appearance: 'none' as const,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#7C5CFC')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            返回
          </button>
        ) : (
          <span className="wk-todo-side-panel__header-title">任务详情</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {todo && (
            <button
              type="button"
              onClick={handleToggleStatus}
              style={{
                padding: '3px 10px', border: 'none', borderRadius: '4px',
                background: todo.status === 'open' ? '#ef4444' : '#7C5CFC',
                color: '#fff', fontSize: '12px', fontWeight: 500,
                cursor: 'pointer', lineHeight: '1.5',
                appearance: 'none' as const, outline: 'none',
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {todo.status === 'open' ? '关闭任务' : '重新打开'}
            </button>
          )}
          {!showBack && (
            <button type="button" className="wk-todo-side-panel__close" onClick={onClose}>✕</button>
          )}
        </div>
      </div>
      <div className="wk-todo-side-panel__body">
        {loading && <div className="wk-todo-list__loading">加载中...</div>}
        {!loading && !todo && <div className="wk-todo-list__empty">加载失败</div>}
        {!loading && todo && (
          <>
            {/* 任务名 inline 编辑 */}
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                className="wk-detail-panel__title-input"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                disabled={updatingTitle}
              />
            ) : (
              <h2 className="wk-todo-detail__title wk-detail-panel__title-clickable" onClick={handleStartEditTitle}>
                {todo.title}
              </h2>
            )}

            {/* 状态标签（只读属性，操作在右上角） */}
            <div className="wk-todo-detail__status">
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: '4px',
                background: '#f0f0f0', color: '#555',
                fontSize: '11px', fontWeight: 500,
                letterSpacing: '0.2px',
              }}>
                {todo.status === 'open' ? '待处理' : '已完成'}
              </span>
            </div>

            {/* 备注 */}
            {todo.description && <div className="wk-todo-detail__desc">{todo.description}</div>}

            <div className="wk-todo-detail__meta">
              {/* 负责人 (MemberPicker) */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', color: 'var(--wk-text-primary, #1a1a1a)', marginBottom: '8px' }}>
                  <strong style={{ fontWeight: 500 }}>负责人</strong>
                </div>
                <MemberPicker
                  mode="direct"
                  todoId={todo.id}
                  assignees={todo.assignees ?? []}
                  onChanged={(addedUid, removedUid) => {
                    // 乐观更新 assignees，不重载整个 todo
                    setTodo((prev) => {
                      if (!prev) return prev;
                      let assignees = [...(prev.assignees ?? [])];
                      if (removedUid) {
                        assignees = assignees.filter((a) => a.user_id !== removedUid);
                      }
                      if (addedUid) {
                        assignees = [...assignees, {
                          id: `optimistic_${addedUid}`,
                          todo_id: prev.id,
                          user_id: addedUid,
                          created_at: new Date().toISOString(),
                        }];
                      }
                      return { ...prev, assignees };
                    });
                  }}
                  channel={channel}
                />
              </div>

              {/* 截止日期 */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', color: 'var(--wk-text-primary, #1a1a1a)', marginBottom: '8px' }}>
                  <strong style={{ fontWeight: 500 }}>截止日期</strong>
                </div>
                <DatePicker
                  style={{ width: '100%' }}
                  density="compact"
                  placeholder="选择截止日期"
                  value={todo.deadline ? new Date(todo.deadline) : undefined}
                  onChange={(date) => {
                    if (!date) { handleDeadlineChange(''); return; }
                    const d = date instanceof Date ? date : new Date(date as string);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const off = new Date().getTimezoneOffset();
                    const sign = off <= 0 ? '+' : '-';
                    const oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
                    const om = String(Math.abs(off) % 60).padStart(2, '0');
                    handleDeadlineChange(`${yyyy}-${mm}-${dd}T23:59:59${sign}${oh}:${om}`);
                  }}
                  disabledDate={(date) => !!date && date < new Date(new Date().setHours(0,0,0,0))}
                />
              </div>

              {/* 提醒时间 (remind_at) */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', color: 'var(--wk-text-primary, #1a1a1a)', marginBottom: '8px' }}>
                  <strong style={{ fontWeight: 500 }}>提醒时间</strong>
                </div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', width: '100%', minWidth: 0 }}>
                  <button
                    type="button"
                    className={`wk-detail-panel__remind-btn ${remindMode === 'none' ? 'wk-detail-panel__remind-btn--active' : ''}`}
                    onClick={() => handleRemindModeChange('none')}
                  >
                    不提醒
                  </button>
                  <button
                    type="button"
                    className={`wk-detail-panel__remind-btn ${remindMode === '1h' ? 'wk-detail-panel__remind-btn--active' : ''}`}
                    onClick={() => handleRemindModeChange('1h')}
                    disabled={!todo.deadline}
                  >
                    前1小时
                  </button>
                  <button
                    type="button"
                    className={`wk-detail-panel__remind-btn ${remindMode === '1d' ? 'wk-detail-panel__remind-btn--active' : ''}`}
                    onClick={() => handleRemindModeChange('1d')}
                    disabled={!todo.deadline}
                  >
                    前1天
                  </button>
                  <button
                    type="button"
                    className={`wk-detail-panel__remind-btn ${remindMode === 'custom' ? 'wk-detail-panel__remind-btn--active' : ''}`}
                    onClick={() => handleRemindModeChange('custom')}
                  >
                    自定义
                  </button>
                </div>
                {remindMode === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customRemindTime}
                    onChange={(e) => setCustomRemindTime(e.target.value)}
                    onBlur={(e) => handleCustomRemindTimeChange(e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      padding: '6px 10px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      fontSize: '13px',
                      background: '#fff',
                      color: '#1a1a1a',
                      outline: 'none',
                      boxSizing: 'border-box' as const,
                    }}
                  />
                )}
              </div>

              {/* 所属项目 (Goal) */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', color: 'var(--wk-text-primary, #1a1a1a)', marginBottom: '8px' }}>
                  <strong style={{ fontWeight: 500 }}>所属项目</strong>
                </div>
                <select
                  value={todo.goal_id || ''}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  disabled={updatingGoal}
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--wk-border-default, #e5e5e5)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--wk-bg-surface, #fff)',
                    color: 'var(--wk-text-primary, #1a1a1a)',
                    outline: 'none',
                    cursor: 'pointer',
                    opacity: updatingGoal ? 0.5 : 1,
                    boxSizing: 'border-box' as const,
                  }}
                >
                  <option value="">未设置项目</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 来源频道 */}
              {todo.source_channel_id && todo.source_channel_type && (
                <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', color: '#999', whiteSpace: 'nowrap', flexShrink: 0 }}>来源</span>
                  <button
                    type="button"
                    onClick={handleJumpToChannel}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: 0, border: 'none', background: 'transparent',
                      cursor: 'pointer', appearance: 'none' as const, outline: 'none',
                      color: '#7C5CFC', fontSize: '13px', fontWeight: 500,
                      textDecoration: 'underline', textDecorationColor: 'transparent',
                      transition: 'text-decoration-color 150ms',
                      minWidth: 0, overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = '#7C5CFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = 'transparent')}
                  >
                    <img
                      alt=""
                      src={WKApp.shared.avatarChannel(new Channel(todo.source_channel_id, todo.source_channel_type))}
                      style={{ width: 18, height: 18, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {todo.source_name || '查看来源'}
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.6, flexShrink: 0 }}>↗</span>
                  </button>
                </div>
              )}

              <div className="wk-todo-detail__timestamps">
                创建于 {new Date(todo.created_at).toLocaleString('zh-CN')} · 更新于 {new Date(todo.updated_at).toLocaleString('zh-CN')}
              </div>
            </div>

            {/* 附件 */}
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--wk-border-default, #f0f0f0)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px', color: 'var(--wk-text-primary, #1a1a1a)' }}>附件 ({attachments.length})</strong>
                {!showAttachForm && (
                  <button
                    type="button"
                    onClick={() => setShowAttachForm(true)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--wk-brand-primary, #7C5CFC)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    + 添加
                  </button>
                )}
              </div>
              {showAttachForm && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="File URL (required)"
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid var(--wk-border-default, #e5e5e5)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box' as const,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="File name (optional)"
                    value={attachName}
                    onChange={(e) => setAttachName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddAttachment();
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid var(--wk-border-default, #e5e5e5)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box' as const,
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleAddAttachment}
                      disabled={!attachUrl.trim() || attachSubmitting}
                      style={{
                        padding: '5px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'var(--wk-brand-primary, #7C5CFC)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        opacity: !attachUrl.trim() || attachSubmitting ? 0.5 : 1,
                      }}
                    >
                      {attachSubmitting ? '...' : '添加'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachForm(false);
                        setAttachUrl('');
                        setAttachName('');
                      }}
                      style={{
                        padding: '5px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: 'var(--wk-text-tertiary, #999)',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'var(--wk-bg-base, #f7f8fa)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <a
                      href={isSafeUrl(a.file_url) ? a.file_url : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--wk-brand-primary, #7C5CFC)',
                        textDecoration: 'none',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      📎 {a.file_name || 'Attachment'}
                      {a.file_size ? ` (${(a.file_size / 1024).toFixed(1)} KB)` : ''}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(a.id)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'var(--wk-text-disabled, #ccc)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        padding: '0 2px',
                        transition: 'color 150ms',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {attachments.length === 0 && !showAttachForm && (
                  <div style={{ color: 'var(--wk-text-disabled, #bbb)', fontSize: '13px', padding: '4px 0' }}>暂无附件</div>
                )}
              </div>
            </div>

            {/* 评论 */}
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--wk-border-default, #f0f0f0)', paddingTop: '14px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--wk-text-primary, #1a1a1a)' }}>评论 ({comments.length})</strong>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {comments.map((c) => (
                  <div key={c.id} style={{ padding: '10px 12px', background: 'var(--wk-bg-base, #f7f8fa)', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--wk-text-primary, #1a1a1a)', fontSize: '12px' }}>
                        <UserName uid={c.user_id} />
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--wk-text-tertiary, #999)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {new Date(c.created_at).toLocaleString('zh-CN')}
                        {c.user_id === WKApp.loginInfo.uid && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--wk-text-disabled, #ccc)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              padding: '0 2px',
                              transition: 'color 150ms',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    </div>
                    <div style={{ color: 'var(--wk-text-secondary, #555)', lineHeight: '1.5' }}>{c.content}</div>
                  </div>
                ))}
                {comments.length === 0 && <div style={{ color: 'var(--wk-text-disabled, #bbb)', fontSize: '13px', padding: '8px 0' }}>暂无评论</div>}
              </div>
              {/* 添加 comment */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="添加评论..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 12px',
                    border: '1px solid var(--wk-border-default, #e5e5e5)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'border-color 150ms',
                    boxSizing: 'border-box' as const,
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submitting}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'var(--wk-brand-primary, #7C5CFC)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    opacity: !newComment.trim() || submitting ? 0.5 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  发送
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
