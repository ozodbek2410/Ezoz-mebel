import XLSX from "xlsx-js-style";

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

// Style constants
const TITLE_STYLE: XLSX.CellStyle = {
  font: { bold: true, sz: 14, color: { rgb: "1E293B" } },
  alignment: { horizontal: "center", vertical: "center" },
};

const HEADER_STYLE: XLSX.CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "334155" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "1E293B" } },
    bottom: { style: "thin", color: { rgb: "1E293B" } },
    left: { style: "thin", color: { rgb: "1E293B" } },
    right: { style: "thin", color: { rgb: "1E293B" } },
  },
};

const DATA_STYLE: XLSX.CellStyle = {
  font: { sz: 11, color: { rgb: "1E293B" } },
  alignment: { vertical: "center" },
  border: {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  },
};

const DATA_STYLE_ALT: XLSX.CellStyle = {
  ...DATA_STYLE,
  fill: { fgColor: { rgb: "F8FAFC" } },
};

const TOTAL_STYLE: XLSX.CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1E293B" } },
  fill: { fgColor: { rgb: "E2E8F0" } },
  alignment: { vertical: "center" },
  border: {
    top: { style: "medium", color: { rgb: "64748B" } },
    bottom: { style: "medium", color: { rgb: "64748B" } },
    left: { style: "thin", color: { rgb: "94A3B8" } },
    right: { style: "thin", color: { rgb: "94A3B8" } },
  },
};

function isNumeric(val: unknown): boolean {
  if (typeof val === "number") return true;
  if (typeof val === "string") {
    const cleaned = val.replace(/[\s,]/g, "");
    return cleaned !== "" && !isNaN(Number(cleaned));
  }
  return false;
}

/**
 * Export data to Excel (.xlsx) file with professional styling.
 * Dark header, alternating row colors, borders, bold title, total row detection.
 */
export function exportToExcel({ filename, sheetName = "Sheet1", title, columns, data }: ExportOptions): void {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  let rowIdx = 0;

  // Title row
  if (title) {
    const titleCell: XLSX.CellObject = { v: title, t: "s", s: TITLE_STYLE };
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = titleCell;
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } });
    rowIdx += 2; // title + empty row
  }

  const headerRowIdx = rowIdx;

  // Header row
  for (let c = 0; c < columns.length; c++) {
    const col = columns[c]!;
    ws[XLSX.utils.encode_cell({ r: rowIdx, c })] = {
      v: col.header,
      t: "s",
      s: HEADER_STYLE,
    };
  }
  rowIdx++;

  // Data rows
  for (let r = 0; r < data.length; r++) {
    const row = data[r]!;
    const isAlt = r % 2 === 1;
    const isLastRow = r === data.length - 1;

    // Detect "total" row (last row with "JAMI" or total-like label)
    const firstVal = row[columns[0]?.key ?? ""];
    const secondVal = row[columns[1]?.key ?? ""];
    const isTotalRow = isLastRow && (
      (typeof firstVal === "string" && /jami|итого|total/i.test(firstVal)) ||
      (typeof secondVal === "string" && /jami|итого|total/i.test(secondVal))
    );

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c]!;
      const val = row[col.key];
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c });

      let style: XLSX.CellStyle;
      if (isTotalRow) {
        style = TOTAL_STYLE;
      } else {
        style = isAlt ? { ...DATA_STYLE_ALT } : { ...DATA_STYLE };
      }

      // Right-align numeric values
      if (isNumeric(val)) {
        style = { ...style, alignment: { ...style.alignment, horizontal: "right" } };
      }

      // Center "#" column
      if (col.header === "#" || col.key === "idx") {
        style = { ...style, alignment: { ...style.alignment, horizontal: "center" } };
      }

      const cell: XLSX.CellObject = {
        v: val != null ? val : "",
        t: typeof val === "number" ? "n" : "s",
        s: style,
      };

      ws[cellRef] = cell;
    }
    rowIdx++;
  }

  // Set sheet range
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rowIdx - 1, c: columns.length - 1 },
  });

  // Column widths
  ws["!cols"] = columns.map((col) => ({ wch: col.width ?? 15 }));

  // Row heights
  const rowHeights: Array<{ hpx: number }> = [];
  for (let r = 0; r < rowIdx; r++) {
    if (title && r === 0) {
      rowHeights.push({ hpx: 30 });
    } else if (r === headerRowIdx) {
      rowHeights.push({ hpx: 24 });
    } else {
      rowHeights.push({ hpx: 20 });
    }
  }
  ws["!rows"] = rowHeights;

  // Merges
  if (merges.length > 0) {
    ws["!merges"] = merges;
  }

  // Auto-filter on header row
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIdx, c: 0 },
      e: { r: headerRowIdx + data.length, c: columns.length - 1 },
    }),
  };

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
