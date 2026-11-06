import { Schema, model } from 'mongoose';

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true },
});

export const Counter = model('Counter', counterSchema);

/** Atomically returns the next value of a named sequence, starting at `start`. */
export async function nextSequence(name: string, start = 1): Promise<number> {
  // Seed the counter once so the first $inc yields `start`.
  await Counter.updateOne({ _id: name }, { $setOnInsert: { seq: start - 1 } }, { upsert: true });
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
  return doc!.seq;
}
