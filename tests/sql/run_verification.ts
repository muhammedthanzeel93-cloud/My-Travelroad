import { spawnSync } from "child_process";
import * as path from "path";

function main() {
  console.log("=======================================================");
  console.log("Running Live Database SQL Verification Suite");
  console.log("=======================================================\n");

  const sqlFilePath = path.join(__dirname, "verification_tests.sql");

  // Determine psql executable:
  // 1. Explicitly configured PSQL_BIN environment variable
  // 2. Default to 'psql' in system PATH
  const psqlBin = process.env.PSQL_BIN || "psql";

  const host = process.env.PGHOST || "127.0.0.1";
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER || "postgres";
  const dbname = process.env.PGDATABASE || "mytravelroad";

  console.log(`Connecting to: ${user}@${host}:${port}/${dbname}`);
  console.log(`Using executable: ${psqlBin}`);
  console.log(`Executing SQL script: ${sqlFilePath}\n`);

  const result = spawnSync(
    psqlBin,
    ["-v", "ON_ERROR_STOP=1", "-U", user, "-h", host, "-p", port, "-d", dbname, "-f", sqlFilePath],
    {
      stdio: "inherit",
      encoding: "utf-8",
      env: process.env,
    }
  );

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        `\nError: PostgreSQL client executable '${psqlBin}' was not found.\n` +
          "Please ensure PostgreSQL client tools are installed and 'psql' is added to your system PATH,\n" +
          "or specify the executable path via the PSQL_BIN environment variable.\n" +
          "Example: PSQL_BIN=/usr/local/bin/psql npm run test:sql\n"
      );
    } else {
      console.error(`\nError executing psql: ${result.error.message}`);
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nSQL verification tests failed with exit code: ${result.status}`);
    process.exit(result.status ?? 1);
  }

  console.log("\n=======================================================");
  console.log("All SQL verification tests passed successfully!");
  console.log("=======================================================\n");
  process.exit(0);
}

main();
