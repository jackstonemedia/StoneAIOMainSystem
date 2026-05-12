import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface APPiece {
  name: string;
  displayName: string;
  description: string;
  logoUrl: string;
  version: string;
  categories: string[];
  actions: Record<string, any>;
  triggers: Record<string, any>;
}

export function usePieces(params?: { includeHidden?: boolean; searchQuery?: string }) {
  return useQuery({
    queryKey: ['ap-pieces', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/pieces', { params });
      return data as APPiece[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePieceDetail(pieceName: string | undefined, version?: string) {
  return useQuery({
    queryKey: ['ap-piece', pieceName, version],
    queryFn: async () => {
      if (!pieceName) return null;
      const { data } = await apiClient.get(`/pieces/${encodeURIComponent(pieceName)}`, {
        params: version ? { version } : undefined,
      });
      return data as APPiece;
    },
    enabled: !!pieceName,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePieceOptions(
  pieceName: string,
  pieceVersion: string,
  stepName: string,
  propertyName: string,
  input: Record<string, any>,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['ap-piece-options', pieceName, pieceVersion, stepName, propertyName, input],
    queryFn: async () => {
      const payload = {
        pieceVersion,
        stepName,
        propertyName,
        input,
      };
      const { data } = await apiClient.post(`/pieces/${encodeURIComponent(pieceName)}/options`, payload);
      // Activepieces usually returns { options: [...] }
      return data?.options || data || [];
    },
    enabled: enabled && !!pieceName && !!propertyName,
    staleTime: 60 * 1000,
  });
}
