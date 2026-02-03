export function detectCompletion(output: string): boolean {
  return output.includes("<promise>COMPLETE</promise>");
}

