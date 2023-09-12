const path = require("path");
const notarize = require("@electron/notarize");

require("dotenv").config({ path: ".env.local" });

async function main(params) {
  // Notarization only applies to macOS
  if (process.platform !== "darwin") {
    return;
  }

  const appId = "kim.kanu.quaxar";
  console.log(params.appOutDir);
  const appPath = path.join(params.appOutDir, `quaxar.app`);

  try {
    console.log(`  • Notarizing`);
    await notarize.notarize({
      tool: "notarytool",
      appBundleId: appId,
      appPath,
      appleId: process.env.APPLE_ID_EMAIL,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports = main;

main({
  appOutDir: "/Users/keonwoo/Projects/hackathon/qso/dist/mac-arm64",
});
