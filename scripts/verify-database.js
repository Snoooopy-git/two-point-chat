const { parseArgs, resolvePath } = require('./lib/cli');
const { verifyDatabase } = require('./lib/database-tools');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const databasePath = resolvePath(
    args.database,
    process.env.DB_VERIFY_PATH || process.env.CHAT_DB_PATH
  );
  const result = verifyDatabase(databasePath, { username: args.username });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`数据库验证失败: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main };
