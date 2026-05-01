import { useState, useCallback, useEffect } from 'react';
import * as api from '../api/todoApi';
import type { Goal, GoalStatus } from '../bridge/types';
import { Toast } from '../utils/toast';

export interface UseGoalListOptions {
  status?: GoalStatus;
}

export interface UseGoalListResult {
  goals: Goal[];
  loading: boolean;
  reload: () => void;
}

export function useGoalList({ status }: UseGoalListOptions = {}): UseGoalListResult {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    api
      .listGoals(status)
      .then(setGoals)
      .catch(() => Toast.error('加载目标失败'))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { goals, loading, reload };
}
