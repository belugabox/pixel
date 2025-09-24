/*
  Simple harness to test ScreenScraper flow from Node (main process-like).
  Usage (Windows cmd):
    set PIXEL_TEST_ROMS=c:\\path\\to\\roms
    set PIXEL_TEST_SYSTEM=snes
    set PIXEL_TEST_ROM="Super Mario World.smc"
    set PIXEL_SSID=your_user
    set PIXEL_SSPASSWORD=your_password
    rem Optional dev credentials
    set PIXEL_DEVID=
    set PIXEL_DEVPASSWORD=
    set PIXEL_SOFTNAME=pixel
    npx ts-node --compiler-options {\"module\":\"commonjs\"} scripts/test-screenscraper.ts
*/

import { MetadataService } from "../src/services/metadata-service";

async function main() {
  const romsRoot = (process.env.PIXEL_TEST_ROMS || "").trim();
  const system = (process.env.PIXEL_TEST_SYSTEM || "snes").trim();
  const romName = (process.env.PIXEL_TEST_ROM || "").trim();

  if (!romsRoot || !romName) {
    console.error("Please set PIXEL_TEST_ROMS and PIXEL_TEST_ROM.");
    process.exit(1);
  }

  const service = new MetadataService({
    screenscraper: {
      ssid: process.env.PIXEL_SSID,
      sspassword: process.env.PIXEL_SSPASSWORD,
      devid: process.env.PIXEL_DEVID,
      devpassword: process.env.PIXEL_DEVPASSWORD,
      softname: process.env.PIXEL_SOFTNAME || "pixel",
    },
  });

  console.log("Downloading metadata...", { system, romName, romsRoot });
  try {
    const result = await service.downloadMetadata(romName, system, romsRoot);
    console.log("Result:", result);
  } catch (e) {
    console.error("Harness error:", e);
  }
}

main();
