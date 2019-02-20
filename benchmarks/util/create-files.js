'use strict'

const { generateFiles, verifyTestFiles } = require('./')

/**
 * This utility will verify or create files needed for the tests.
 *
 * @async
 * @function verifyAndCreateFiles
 */
const verifyAndCreateFiles = async () => {
  const valid = await verifyTestFiles()
  if (!valid) {
    console.log('Some files missing.  Generating files')
    await generateFiles()
  } else {
    console.log('Files Verified')
  }
}
if (require.main === module) {
  verifyAndCreateFiles()
}
module.exports = verifyAndCreateFiles
