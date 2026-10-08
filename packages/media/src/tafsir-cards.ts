import type { TafsirUnit } from "@daydan/core";

/** A piece of one tafsir unit placed on a card. */
export interface CardPiece {
  /** Index of the unit, to tell where one ayah's tafsir ends and the next begins. */
  unit: number;
  surah: number;
  from: number;
  to: number;
  label: string;
  isPointer: boolean;
  text: string;
  /** The first piece of a unit carries its ayah number. */
  isFirst: boolean;
}

export type Card = CardPiece[];

/** Whether these pieces fit on one card. Measured in a real browser by the renderer. */
export type FitsOnCard = (pieces: readonly CardPiece[]) => Promise<boolean>;

// Splitting never removes or adds a character: it only chooses where one card ends.
const sentences = (text: string) => text.split(/(?<=[.؟!])\s+/);
const clauses = (text: string) => text.split(/(?<=[،؛;])\s+/);

/**
 * Lays out tafsir units on as few cards as possible:
 * whole units together when they fit, never two surahs on one card,
 * and a unit too long for one card split at sentence (then clause) boundaries, never mid-word.
 */
export async function packTafsirCards(units: readonly TafsirUnit[], fits: FitsOnCard): Promise<Card[]> {
  const cards: Card[] = [];
  let current: CardPiece[] = [];
  const flush = () => {
    if (current.length) cards.push(current);
    current = [];
  };
  const place = async (piece: CardPiece, context: string) => {
    if (await fits([...current, piece])) return void current.push(piece);
    flush();
    if (!(await fits([piece]))) throw new Error(`${context}: a single passage is longer than a card`);
    current.push(piece);
  };

  for (const [index, unit] of units.entries()) {
    if (current.length && current[0]!.surah !== unit.surah) flush();
    const base = { unit: index, surah: unit.surah, from: unit.from, to: unit.to, label: unit.label, isPointer: unit.isPointer };
    const whole: CardPiece = { ...base, text: unit.text, isFirst: true };

    if (await fits([...current, whole])) {
      current.push(whole);
      continue;
    }
    flush();
    if (await fits([whole])) {
      current.push(whole);
      continue;
    }

    const parts: string[] = [];
    for (const sentence of sentences(unit.text)) {
      const fitsAlone = await fits([{ ...whole, text: sentence }]);
      parts.push(...(fitsAlone ? [sentence] : clauses(sentence)));
    }
    for (const [i, text] of parts.entries()) await place({ ...base, text, isFirst: i === 0 }, `ayah ${unit.label}`);
  }
  flush();
  return cards;
}
