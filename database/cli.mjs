import { existsSync, renameSync } from 'node:fs';
import { openDatabase, resolveDatabasePath } from './connection.mjs';
import { makeMigration, migrate, migrationStatus, rollbackLatestBatch } from './migrator.mjs';

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'make') {
    const path = makeMigration(args[0]);
    console.log(`Created ${path}`);
  } else if (command === 'fresh') {
    if (!args.includes('--confirm')) {
      throw new Error('db:fresh elimina lo schema locale. Riesegui con: node database/cli.mjs fresh --confirm');
    }

    const databasePath = resolveDatabasePath();
    const backupSuffix = `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    for (const suffix of ['', '-wal', '-shm']) {
      const sourcePath = `${databasePath}${suffix}`;
      if (existsSync(sourcePath)) renameSync(sourcePath, `${sourcePath}${backupSuffix}`);
    }

    const db = openDatabase();
    try {
      const result = await migrate(db);
      console.log(`Created fresh database${result.applied.length ? `: ${result.applied.join(', ')}` : '.'}`);
    } finally {
      db.close();
    }
  } else if (['migrate', 'status', 'rollback'].includes(command)) {
    const db = openDatabase();
    try {
      if (command === 'migrate') {
        const result = await migrate(db);
        console.log(result.applied.length ? `Applied batch ${result.batch}: ${result.applied.join(', ')}` : 'No pending migrations.');
      } else if (command === 'status') {
        const status = await migrationStatus(db);
        if (!status.length) console.log('No migration files found.');
        for (const item of status) console.log(`${item.applied ? 'applied' : 'pending'}\t${item.batch ?? '-'}\t${item.name}`);
      } else {
        const result = await rollbackLatestBatch(db);
        console.log(result.rolledBack.length ? `Rolled back batch ${result.batch}: ${result.rolledBack.join(', ')}` : 'No applied migrations to roll back.');
      }
    } finally {
      db.close();
    }
  } else {
    throw new Error('Usage: db:make <slug> | db:migrate | db:status | db:rollback | db:fresh --confirm');
  }
} catch (error) {
  console.error(`Database command failed: ${error.message}`);
  process.exitCode = 1;
}
