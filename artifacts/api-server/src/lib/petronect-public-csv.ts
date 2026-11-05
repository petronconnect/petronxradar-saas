export type PetronectPublicRow = {
  rowNumber: number;
  petronectId: string;
  title: string;
  subStatus: string | null;
  company: string | null;
  scope: string | null;
  startDate: string | null;
  endDate: string | null;
  processType: string | null;
  deliveryLocation: string | null;
  error: string | null;
};

const MAX_CSV_CHARS = 5_000_000;
const MAX_ROWS = 5_000;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function splitCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (delimiter: string) => firstLine.split(delimiter).length - 1;
  const delimiter = count(";") > count(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV inválido: há um campo entre aspas sem fechamento.");
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = Number(match?.[3] ?? iso?.[1]);
  const month = Number(match?.[2] ?? iso?.[2]);
  const day = Number(match?.[1] ?? iso?.[3]);
  if (!year || !month || !day) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

const HEADER_ALIASES: Record<string, string[]> = {
  id: ["numero", "numero da oportunidade", "numero oportunidade", "numero da licitacao"],
  title: ["objeto", "objeto da contratacao", "objeto de contratacao"],
  subStatus: ["sub status", "substatus", "sub status da oportunidade"],
  company: ["empresa"],
  scope: ["abrangencia"],
  startDate: ["data inicio", "data de inicio"],
  endDate: ["data fim", "data de fim"],
  processType: ["tipo", "tipo de oportunidade"],
  deliveryLocation: ["local de entrega", "local entrega"],
};

export function parsePetronectPublicCsv(input: string): PetronectPublicRow[] {
  if (typeof input !== "string" || input.length > MAX_CSV_CHARS) {
    throw new Error("O CSV deve ter até 5 MB.");
  }
  const grid = splitCsv(input.replace(/^\uFEFF/, ""));
  if (grid.length < 2) throw new Error("A planilha não contém linhas de oportunidades.");
  if (grid.length - 1 > MAX_ROWS) throw new Error(`Importe no máximo ${MAX_ROWS} linhas por arquivo.`);
  const headers = grid[0]!.map(normalize);
  const indexes: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    indexes[field] = headers.findIndex(header => aliases.includes(header));
  }
  if (indexes.id < 0 || indexes.title < 0) {
    throw new Error("Colunas obrigatórias não encontradas. Use Número e Objeto, conforme a exportação Petronect.");
  }
  const seen = new Set<string>();
  return grid.slice(1).map((cells, index) => {
    const read = (field: string) => indexes[field]! >= 0 ? (cells[indexes[field]!] ?? "").trim().slice(0, 1000) : "";
    const petronectId = read("id").replace(/\s+/g, "");
    const title = read("title");
    let error: string | null = null;
    if (!/^\d{6,14}$/.test(petronectId)) error = "Número da oportunidade inválido.";
    else if (!title) error = "Objeto não informado.";
    const startRaw = read("startDate"), endRaw = read("endDate");
    const startDate = parseDate(startRaw), endDate = parseDate(endRaw);
    if (!error && startRaw && !startDate) error = "Data de início inválida.";
    if (!error && endRaw && !endDate) error = "Data final inválida.";
    if (!error && seen.has(petronectId)) error = "Número repetido neste arquivo.";
    if (petronectId) seen.add(petronectId);
    return {
      rowNumber: index + 2,
      petronectId,
      title,
      subStatus: read("subStatus") || null,
      company: read("company") || null,
      scope: read("scope") || null,
      startDate,
      endDate,
      processType: read("processType") || null,
      deliveryLocation: read("deliveryLocation") || null,
      error,
    };
  });
}

export const PETRONECT_PUBLIC_IMPORT_LIMITS = { maxCsvChars: MAX_CSV_CHARS, maxRows: MAX_ROWS };
