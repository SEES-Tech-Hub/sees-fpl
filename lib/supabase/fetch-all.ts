// Supabase's API returns at most 1,000 rows per request, silently. Reads that
// can be bigger than that (every manager's picks, every stored score) page
// through with this. `page(from, to)` must return the rows in a stable order
// (order by a unique key), so no row is skipped or repeated between pages.
//
//   const picks = await fetchAll((from, to) =>
//     admin.from("picks").select("*").eq("matchday_id", id).order("id").range(from, to));

export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
