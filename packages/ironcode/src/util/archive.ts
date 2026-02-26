import { extractZipFFI } from "../tool/ffi"

export namespace Archive {
  export async function extractZip(zipPath: string, destDir: string) {
    extractZipFFI(zipPath, destDir)
  }
}
