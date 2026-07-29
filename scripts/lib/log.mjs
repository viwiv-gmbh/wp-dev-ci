// Shared, consistent console output so every script fails the same way:
// a clear reason on stderr and a non-zero exit code the CI job can act on.

export function ok(message) {
  console.log(`✔ ${message}`);
}

export function info(message) {
  console.log(`ℹ ${message}`);
}

/** Print a reason and exit non-zero. Never throws, so call sites don't need try/catch. */
export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Wrap a script's main() so any thrown Error becomes a clean fail() instead of a stack trace. */
export async function run(main) {
  try {
    await main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
