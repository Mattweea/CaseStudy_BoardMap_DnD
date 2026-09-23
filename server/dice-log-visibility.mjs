export function canUserSeeDiceLog(log, user) {
  return user?.role === 'master' || log.visibility === 'public' || log.authorUserId === user?.id;
}

export function visibleDiceLogsForUser(logs, user) {
  return logs.filter((log) => canUserSeeDiceLog(log, user));
}
