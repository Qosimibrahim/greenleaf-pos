import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Fetches primary image URLs for a batch of product ids.
 * Returns a map keyed by product_id → URL (or "" when none).
 * Images are stored locally via Multer — served from /uploads/*.
 */
export function useProductImages(productIds: string[]) {
  const key = [...new Set(productIds)].sort().join(",");
  return useQuery({
    queryKey: ["product-image-urls", key],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const ids = [...new Set(productIds)];
      const result: Record<string, string> = {};

      await Promise.all(
        ids.map(async (pid) => {
          try {
            const images = await api.get<Array<{ product_id: string; storage_path: string; is_primary: boolean }>>(
              `/product_images?product_id=${pid}`,
            );
            const primary = images.find((i) => i.is_primary) ?? images[0];
            if (primary?.storage_path) {
              // storage_path is like "/uploads/filename.jpg" returned from server
              result[pid] = primary.storage_path.startsWith("http")
                ? primary.storage_path
                : primary.storage_path;
            } else {
              result[pid] = "";
            }
          } catch {
            result[pid] = "";
          }
        }),
      );
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}
