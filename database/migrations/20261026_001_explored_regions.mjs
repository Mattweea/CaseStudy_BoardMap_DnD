export function up(db) {
  db.exec(`CREATE TABLE explored_regions (
  scene_id TEXT PRIMARY KEY REFERENCES scenes(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  regions_json TEXT NOT NULL CHECK(json_valid(regions_json))
 )`);
}
export function down(db) {
  db.exec('DROP TABLE explored_regions');
}
