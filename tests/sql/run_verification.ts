import { spawnSync } from "child_process";
import * as path from "path";

function main() {
  console.log("=======================================================");
  console.log("Running Live Database SQL Verification Suite");
  console.log("=======================================================\n");

  const sqlFilePath = path.join(__dirname, "verification_tests.sql");

  // Locate psql binary
  const customPsql = "C:\\Users\\aysha\\.gemini\\antigravity\\brain\\b2df7124-c0e8-42e5-8422-2d4f5a11366d\\scratch\\pg16\\pgsql\\bin\\psql.exe";
  const psqlBin = require("fs").existsSync(customPsql) ? customPsql : "psql";

  const host = process.env.PGHOST || "127.0.0.1";
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER || "postgres";
  const dbname = process.env.PGDATABASE || "mytravelroad";

  console.log(`Connecting to: ${user}@${host}:${port}/${dbname}`);
  console.log(`Executing SQL script: ${sqlFilePath}\n`);

  const result = spawnSync(
    psqlBin,
    ["-v", "ON_ERROR_STOP=1", "-U", user, "-h", host, "-p", port, "-d", dbname, "-f", sqlFilePath],
    {
      stdio: "inherit",
      encoding: "utf-8",
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || "postgrespassword" },
    }
  );

  if (result.status !== 0) {
    console.error(`\nSQL verification tests failed with exit code: ${result.status}`);
    process.exit(result.status || 1);
  }

  console.log("\n=======================================================");
  console.log("All SQL verification tests passed successfully!");
  console.log("=======================================================\n");
  process.exit(0);
}

main();
