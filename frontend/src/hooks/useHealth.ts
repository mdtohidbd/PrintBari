import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../api/health.api';

export const useHealth = () => {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.getHealth,
    refetchInterval: 10000, // Auto-refresh health every 10 seconds
    retry: 2,
  });
};

