export function broadcastCharacterSheetEvent(clients, event, sheet, policy) {
  for (const client of clients) {
    const isPublicPortrait = event.type === 'character-sheet-portrait';
    if (!isPublicPortrait && !policy.canSubscribe(client.user, sheet)) continue;
    try {
      client.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
}
