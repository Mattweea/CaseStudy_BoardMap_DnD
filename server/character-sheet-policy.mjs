export class CharacterSheetPolicy {
  canRead(user, sheet) { return this.#canAccess(user, sheet); }
  canWrite(user, sheet) { return this.#canAccess(user, sheet); }
  canSubscribe(user, sheet) { return this.#canAccess(user, sheet); }

  canViewPortrait(user, sheet) {
    return Boolean(user && sheet);
  }

  #canAccess(user, sheet) {
    if (!user || !sheet) return false;
    if (user.role === 'master') return true;
    return user.role === 'adventurer' && user.id === sheet.ownerUserId;
  }
}
