// Datos del SVG del plano (extraídos del HTML "prueba.html" sin cambios).
// NO modificar coordenadas, IDs, ni dimensiones.

export interface PlanoLot {
  manzana: string;
  sitio: string;
  tipo: "A1" | "A2" | "B" | "C";
  x: number;
  y: number;
  w: number;
  h: number;
  cls: string;
  id: string; // M{manzana}-S{sitio}
}

export interface PlanoManzana {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  labelX: number;
  labelY: number;
}

const lots: PlanoLot[] = [];

function add(
  m: number,
  n: number | string,
  t: PlanoLot["tipo"],
  x: number,
  y: number,
  w = 34,
  h = 38,
  cls = "",
) {
  lots.push({
    manzana: String(m),
    sitio: String(n),
    tipo: t,
    x,
    y,
    w,
    h,
    cls,
    id: `M${m}-S${n}`,
  });
}

// Manzana 1 - perímetro
[57, 58, 59, 60, 61, 62].forEach((n, i) =>
  add(1, n, n <= 58 ? "A1" : "A2", 20 + i * 37, 24, 34, 38),
);
[1, 2, 3, 4].forEach((n, i) =>
  add(1, n, n === 3 ? "A2" : n === 4 ? "B" : "A1", 454 + i * 40, 24, 34, 38),
);
for (let n = 5; n <= 24; n++) add(1, n, "A1", 574, 66 + (n - 5) * 30, 34, 29, "small");
[35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25].forEach((n, i) =>
  add(1, n, n === 34 || n === 35 ? "A2" : "A1", 20 + i * 52, 692, 34, 38),
);
for (let n = 36; n <= 56; n++) {
  let tipo: PlanoLot["tipo"] = "A2";
  if (n === 54 || n === 56) tipo = "B";
  if (n === 55) tipo = "C";
  add(1, n, tipo, 20, 660 - (n - 36) * 30, 34, 29, "small");
}

// Manzana 2
[1, 2, 3].forEach((n, i) => add(2, n, "A1", 237, 96 + i * 34, 34, 38));

// Manzana 3
(
  [
    [6, "A1", 240, 241],
    [5, "A1", 278, 241],
    [4, "A1", 316, 241],
    [3, "A1", 354, 241],
    [2, "A1", 392, 241],
    [1, "A1", 430, 241],
    [7, "A1", 240, 285],
    [8, "A1", 240, 327],
    [9, "A2", 278, 303],
    [10, "A2", 316, 303],
    [11, "A2", 354, 303],
    [12, "A2", 392, 303],
    [13, "A2", 430, 303],
  ] as const
).forEach((a) => add(3, a[0], a[1] as PlanoLot["tipo"], a[2], a[3]));

// Manzana 4
(
  [
    [6, "A1", 240, 386],
    [5, "A1", 278, 386],
    [4, "A1", 316, 386],
    [3, "A1", 354, 386],
    [2, "A1", 392, 386],
    [1, "A1", 430, 386],
    [7, "A2", 240, 435],
    [8, "A2", 278, 435],
    [9, "A2", 316, 435],
    [10, "A2", 354, 435],
    [11, "A2", 392, 435],
    [12, "A2", 430, 435],
  ] as const
).forEach((a) => add(4, a[0], a[1] as PlanoLot["tipo"], a[2], a[3]));

// Manzana 5
(
  [
    [5, "A1", 263, 518],
    [6, "A1", 263, 556],
    [7, "A1", 263, 594],
    [8, "A1", 263, 632],
    [4, "A1", 313, 537],
    [3, "A1", 352, 537],
    [2, "A1", 391, 537],
    [1, "A1", 430, 537],
    [9, "A2", 313, 607],
    [10, "A2", 352, 607],
    [11, "A2", 391, 607],
    [12, "A2", 430, 607],
  ] as const
).forEach((a) => add(5, a[0], a[1] as PlanoLot["tipo"], a[2], a[3]));

export const PLANO_LOTS: PlanoLot[] = lots;

export const PLANO_MANZANAS: PlanoManzana[] = [
  { id: "1", x: 6, y: 14, w: 615, h: 722, title: "MANZANA 1 (PERÍMETRO)", labelX: 15, labelY: 18 },
  { id: "2", x: 221, y: 88, w: 168, h: 120, title: "MANZANA 2", labelX: 237, labelY: 92 },
  { id: "3", x: 221, y: 229, w: 266, h: 142, title: "MANZANA 3", labelX: 237, labelY: 233 },
  { id: "4", x: 222, y: 372, w: 262, h: 121, title: "MANZANA 4", labelX: 237, labelY: 376 },
  { id: "5", x: 227, y: 508, w: 248, h: 170, title: "MANZANA 5", labelX: 242, labelY: 512 },
];
