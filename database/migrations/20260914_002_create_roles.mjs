export function up(db) {
  db.exec(`CREATE TABLE roles (
    code TEXT PRIMARY KEY CHECK (code IN ('master', 'adventurer'))
  );
  INSERT INTO roles (code) VALUES ('master'), ('adventurer')`);
}

export function down(db) {
  db.exec('DROP TABLE roles');
}
