import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
}

export function useTableConfig(tableName: string, defaultColumns: ColumnDef[]) {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["settings", "tableConfig", tableName],
    queryFn: () => trpc.settings.getTableConfig.query({ tableName }),
  });

  const saveMutation = useMutation({
    mutationFn: (columns: ColumnDef[]) =>
      trpc.settings.setTableConfig.mutate({
        tableName,
        columnConfig: JSON.stringify(columns),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "tableConfig", tableName] });
    },
  });

  // Merge saved config with defaults
  const savedConfig = configQuery.data as ColumnDef[] | null;
  const columns: ColumnDef[] = defaultColumns.map((def) => {
    if (savedConfig) {
      const saved = savedConfig.find((s) => s.key === def.key);
      if (saved) return { ...def, visible: saved.visible };
    }
    return def;
  });

  function toggleColumn(key: string) {
    const updated = columns.map((c) =>
      c.key === key ? { ...c, visible: !c.visible } : c,
    );
    saveMutation.mutate(updated);
  }

  function isVisible(key: string): boolean {
    return columns.find((c) => c.key === key)?.visible ?? true;
  }

  return { columns, toggleColumn, isVisible, isLoading: configQuery.isLoading };
}
