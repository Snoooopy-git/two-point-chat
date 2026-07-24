const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { parseArgs, resolvePath, isInside } = require('./lib/cli');
const { verifyDatabase } = require('./lib/database-tools');

const repositoryRoot = path.resolve(__dirname, '..');

function backupName(now = new Date()) {
  return `chat-${now.toISOString().replace(/[:.]/g, '-')}.db`;
}

async function createBackup({ source, outDir }) {
  const sourcePath = resolvePath(source, process.env.CHAT_DB_PATH || path.join(repositoryRoot, 'server', 'chat.db'));
  const backupDir = resolvePath(outDir, process.env.BACKUP_DIR);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`源数据库不存在: ${sourcePath}`);
  }
  if (isInside(repositoryRoot, backupDir)) {
    throw new Error('备份目录必须位于代码仓库之外');
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const destination = path.join(backupDir, backupName());
  const sourceDatabase = new Database(sourcePath, {
    readonly: true,
    fileMustExist: true
  });

  try {
    await sourceDatabase.backup(destination);
    const verification = verifyDatabase(destination);
    return { source: sourcePath, backup: destination, verification };
  } catch (error) {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination);
    }
    throw error;
  } finally {
    sourceDatabase.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await createBackup({
    source: args.source,
    outDir: args['out-dir']
  });
  console.log(`BACKUP_PATH=${result.backup}`);
  console.log(`INTEGRITY=${result.verification.integrity}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`数据库备份失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { backupName, createBackup };
