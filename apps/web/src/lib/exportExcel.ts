import * as XLSX from "xlsx";

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
}

/**
 * Export data to Excel (.xlsx) file with formatted columns.
 * Adds optional title row, auto-filter on headers, and frozen header row.
 */
export function exportToExcel({ filename, sheetName = "Sheet1", title, columns, data }: ExportOptions): void {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) => columns.map((col) => row[col.key] ?? ""));

  const allRows: unknown[][] = [];
  let headerRowIdx = 0;

  if (title) {
    allRows.push([title]);
    allRows.push([]);
    headerRowIdx = 2;
  }

  allRows.push(headers);
  allRows.push(...rows);

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws["!cols"] = columns.map((col) => ({ wch: col.width ?? 15 }));

  // Merge title row across all columns
  if (title) {
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
  }

  // Auto-filter on header row
  const lastCol = columns.length - 1;
  const lastRow = headerRowIdx + data.length;
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRowIdx, c: 0 }, e: { r: lastRow, c: lastCol } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
