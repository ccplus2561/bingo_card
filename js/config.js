export const SIZE = 5;
export const CENTER = 2; // 中央 FREE 格的列／欄索引
export const LETTERS = ['B', 'I', 'N', 'G', 'O'];
export const RANGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
export const FILLABLE = SIZE * SIZE - 1; // 24
export const isFree = (r, c) => r === CENTER && c === CENTER;
