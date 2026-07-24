const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, resolvePath, isInside } = require('./lib/cli');
const { verifyDatabase } = require('./lib/database-tools');

function runRecoveryDrill({ backup, username }) {
  const backupPath = resolvePath(backup, process.env.DB_BACKUP_PATH);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`备份文件不存在: ${backupPath}`);
  }

  const drillDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-recovery-'));
  const restoredPath = path.join(drillDirectory, 'restored.db');
  if (!isInside(os.tmpdir(), drillDirectory)) {
    throw new Error('拒绝使用系统临时目录之外的恢复路径');
  }

  try {
    fs.copyFileSync(backupPath, restoredPath, fs.constants.COPYFILE_EXCL);
    return verifyDatabase(restoredPath, { username });
  } finally {
    fs.rmSync(drillDirectory, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runRecoveryDrill({
    backup: args.backup,
    username: args.username
  });
  console.log(`RECOVERY_DRILL=${result.integrity}`);
  console.log(`USERS=${result.userCount}`);
  console.log(`MESSAGES=${result.messageCount}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`恢复演练失败: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { runRecoveryDrill };
