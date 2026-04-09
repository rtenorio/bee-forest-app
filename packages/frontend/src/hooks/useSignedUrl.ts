import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

/**
 * Fetches a pre-signed GET URL for a private R2 object key.
 * The signed URL expires in 1 hour on the server; the cache is refreshed
 * after 50 minutes to ensure the URL is always valid when used.
 *
 * Returns { url, loading, error }.
 * When key is null/undefined, url is null and no request is made.
 */
export function useSignedUrl(key: string | null | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['signed-url', key],
    queryFn: () =>
      apiFetch<{ url: string }>(`/media/signed-url?key=${encodeURIComponent(key!)}`),
    enabled: !!key,
    staleTime: 50 * 60 * 1000,  // 50 minutes — refresh before 1-hour expiry
    gcTime:    55 * 60 * 1000,  // keep in cache 5 min after stale
  });

  return {
    url:     data?.url ?? null,
    loading: isLoading && !!key,
    error:   error ? (error as Error).message : null,
  };
}
