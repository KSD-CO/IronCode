import { generateText, streamText } from "ai"

// Thin typed wrappers around ai generateText/streamText that centralize the
// necessary casts while exposing a clean typed API to callers.
export async function generateStructured<TOutput>(
  params: Omit<Parameters<typeof generateText>[0], "output">,
  outputSpec: any,
): Promise<TOutput> {
  // The SDK typings are complicated; keep casts local to this helper.
  const merged = { ...(params as any), output: outputSpec } as any
  const res = (await generateText<any, TOutput>(merged)) as any
  return res.output as TOutput
}

export async function streamStructured<TOutput>(
  params: Omit<Parameters<typeof streamText>[0], "output">,
  outputSpec: any,
): Promise<TOutput> {
  const merged = { ...(params as any), output: outputSpec } as any
  const res = streamText<any, TOutput>(merged) as any
  for await (const part of res.fullStream) {
    if (part?.type === "error") throw part.error
  }
  return (await res.output) as TOutput
}

export default generateStructured
