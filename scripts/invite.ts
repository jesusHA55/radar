import { closeDatabase } from "@/db/client";
import { createInvite, listInvites } from "@/lib/invites/queries";
import { loadLocalEnv } from "@/lib/utils/load-env";

/**
 * Add invites from the command line.
 *
 *   npm run invite -- ev.jha55@gmail.com emmabay2005@gmail.com
 *   npm run invite -- --list
 */

loadLocalEnv();

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    const invites = await listInvites();
    if (invites.length === 0) {
      console.log("No invites.");
      return;
    }
    for (const invite of invites) {
      console.log(`  ${invite.email.padEnd(34)} ${invite.joined ? "joined" : "pending"}`);
    }
    return;
  }

  const emails = args.filter((arg) => arg.includes("@"));
  if (emails.length === 0) {
    console.error("Usage: npm run invite -- email@example.com [more@example.com]");
    console.error("       npm run invite -- --list");
    process.exitCode = 1;
    return;
  }

  for (const email of emails) {
    const result = await createInvite(email, null);
    console.log(result.ok ? `✓ invited ${result.email}` : `• ${email}: ${result.error}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
