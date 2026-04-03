const { execFileSync } = require("child_process");

exports.default = async function sign(configuration) {
  const endpoint = process.env.AZURE_CODE_SIGNING_ENDPOINT;
  const account = process.env.AZURE_CODE_SIGNING_ACCOUNT;
  const profile = process.env.AZURE_CODE_SIGNING_PROFILE;

  if (!endpoint || !account || !profile) {
    console.log(`Skipping signing (env vars not set): ${configuration.path}`);
    return;
  }

  console.log(`Signing: ${configuration.path}`);

  execFileSync("trusted-signing-cli", [
    "-e", endpoint,
    "-a", account,
    "-c", profile,
    "-r", "http://timestamp.acs.microsoft.com",
    "-d", "sha256",
    configuration.path,
  ], { stdio: "inherit" });
};
