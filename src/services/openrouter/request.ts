export const AI_FEATURES_AVAILABLE = false;
export const AI_PAUSED_MESSAGE =
  'AI features are temporarily paused for a security update. Your programs, saved workouts, and history are still available.';

interface CompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens: number;
  response_format?: { type: string };
}

interface CompletionResponse {
  choices: { message?: { content?: string } }[];
}

// Fail closed. Re-enable only through an authenticated, rate-limited server
// endpoint with a dedicated provider key and a verified provider spending cap.
// Never accept a provider credential in this browser/native application.
export async function requestAICompletion(
  _request: CompletionRequest
): Promise<CompletionResponse> {
  throw new Error(AI_PAUSED_MESSAGE);
}
