export function logError(error: any, context: string) {
  console.error(`[${context}] Error:`, error);
  
  // In production, send to crash reporting service
  // For now, just log to console
  
  return {
    message: error?.message || 'Unknown error',
    context,
    timestamp: new Date().toISOString(),
  };
}

export function logWarning(message: string, context: string) {
  console.warn(`[${context}] Warning:`, message);
}