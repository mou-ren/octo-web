import React, { useState, useCallback, useRef } from 'react';
import * as api from '../../api/todoApi';
import type { CreateTodoReq, Todo } from '../../bridge/types';
import CreateTaskModal from '../CreateTaskModal';
import { Toast } from '../../utils/toast';
import './index.css';

export interface QuickAddBarProps {
  channelId: string;
  channelType: number;
  channelName?: string;
  /** Called after a todo is optimistically inserted or confirmed created */
  onCreated: (todo: Todo) => void;
}

/**
 * QuickAddBar — 底部快速添加任务输入框。
 * - Enter：乐观插入假数据，后台创建，失败时回滚
 * - ⊕ 按钮：展开 CreateTaskModal 完整表单
 */
export default function QuickAddBar({
  channelId,
  channelType,
  channelName,
  onCreated,
}: QuickAddBarProps) {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuickCreate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || creating) return;

    // 乐观插入
    const optimisticTodo: Todo = {
      id: `__optimistic__${Date.now()}`,
      title: trimmed,
      status: 'open',
      space_id: '',
      creator_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_channel_id: channelId,
      source_channel_type: channelType,
      source_name: channelName,
    };
    onCreated(optimisticTodo);
    setTitle('');
    setCreating(true);

    try {
      const real = await api.createTodo({
        title: trimmed,
        source_channel_id: channelId,
        source_channel_type: channelType,
        source_name: channelName,
      });
      // 用真实数据替换乐观数据
      onCreated(real);
    } catch {
      Toast.error('创建任务失败');
      // 回滚：通知父组件移除乐观条目（通过特殊 id 标识）
      onCreated({ ...optimisticTodo, id: `__rollback__${optimisticTodo.id}` });
    } finally {
      setCreating(false);
    }
  }, [title, creating, channelId, channelType, channelName, onCreated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleQuickCreate();
      }
    },
    [handleQuickCreate],
  );

  const handleModalConfirm = useCallback(async (req: CreateTodoReq) => {
    const real = await api.createTodo(req);
    Toast.success('任务已创建');
    onCreated(real);
    setShowModal(false);
  }, [onCreated]);

  return (
    <>
      <div className="wk-quick-add-bar">
        <input
          ref={inputRef}
          className="wk-quick-add-bar__input"
          type="text"
          placeholder="快速添加任务... Enter 创建"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={creating}
        />
        <button
          type="button"
          className="wk-quick-add-bar__expand-btn"
          onClick={() => setShowModal(true)}
          title="完整创建表单"
        >
          ⊕
        </button>
      </div>

      <CreateTaskModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onDirtyClose={() => setShowModal(false)}
        onConfirm={handleModalConfirm}
        channel={{ channelId, channelType, name: channelName }}
      />
    </>
  );
}

export { QuickAddBar };
