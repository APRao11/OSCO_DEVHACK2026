export interface PdfTextItemLike {
  str?: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

export function layoutTextItems(items: PdfTextItemLike[]): {
  text: string;
  ranges: Array<[number, number] | null>;
};
