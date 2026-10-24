export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

interface Handlers {
  onMessage: (data: unknown) => void;
  onStatus?: (status: ConnectionStatus) => void;
}

/**
 * WebSocket wrapper with automatic reconnect (exponential backoff, capped at 15s).
 * Returns a cleanup function that stops reconnecting and closes the socket.
 */
export function createSocket(url: string, { onMessage, onStatus }: Handlers): () => void {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const open = () => {
    onStatus?.(attempt === 0 ? 'connecting' : 'reconnecting');
    ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      onStatus?.('open');
    };

    ws.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data as string));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => ws?.close();

    ws.onclose = () => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      onStatus?.('reconnecting');
      timer = setTimeout(open, delay);
    };
  };

  open();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
}
