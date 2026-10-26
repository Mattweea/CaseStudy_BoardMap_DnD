export function up(db) {
  db.exec(`
 CREATE TABLE creature_sheet_definitions (
 id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('character','monster')),version INTEGER NOT NULL DEFAULT 1,
 data_json TEXT NOT NULL CHECK(json_valid(data_json)),portrait_file TEXT,portrait_type TEXT
 );
 CREATE TABLE creature_sheet_bindings (
 id TEXT PRIMARY KEY,scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
 token_id TEXT NOT NULL,token_name TEXT NOT NULL,sheet_id TEXT NOT NULL REFERENCES creature_sheet_definitions(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL DEFAULT 1,instance_json TEXT NOT NULL CHECK(json_valid(instance_json)),UNIQUE(scene_id,token_id)
 );
 CREATE INDEX creature_sheet_bindings_sheet ON creature_sheet_bindings(sheet_id);
`);
}
export function down(db) {
  db.exec('DROP TABLE creature_sheet_bindings; DROP TABLE creature_sheet_definitions;');
}
