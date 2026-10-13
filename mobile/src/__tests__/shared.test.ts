import { execFileSync } from "node:child_process";
import path from "node:path";

// The API client, types and formatters are copied from web/src (the source of truth). If someone edits
// one side and forgets the other, this fails and says which file drifted.
it("mobile's copies of the shared code match web/src", () => {
  const cwd = path.join(__dirname, "..", "..");
  expect(() => execFileSync("node", ["scripts/sync-shared.mjs", "--check"], { cwd, stdio: "pipe" })).not.toThrow();
});
