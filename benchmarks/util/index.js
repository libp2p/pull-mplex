'use strict'

const path = require('path')
const crypto = require('crypto')
const util = require('util')
const fs = require('fs')
const fsWriteFile = util.promisify(fs.writeFile)
const fsMakeDir = util.promisify(fs.mkdir)
const fsExists = util.promisify(fs.access)
const fsStat = util.promisify(fs.lstat)
const fsReadDir = util.promisify(fs.readdir)
const KB = 1024
const MB = KB * 1024

const files = [{
  size: 128 * MB,
  name: '128MBFile'
}, {
  size: 64 * MB,
  name: '64MBFile'
}]

async function generateFiles () {
  const testPath = path.join(__dirname, `../fixtures/`)
  for (let file of files) {
    if (file.count) {
      try {
        await fsExists(`${testPath}${file.name}`)
      } catch (err) {
        await fsMakeDir(`${testPath}${file.name}`)
      }
      for (let i = 0; i < file.count; i++) {
        write(crypto.randomBytes(file.size), `${file.name}/${file.name}-${i}`)
      }
    } else {
      write(crypto.randomBytes(file.size), file.name)
    }
  }
}

async function write (data, name) {
  await fsWriteFile(path.join(__dirname, `../fixtures/${name}.txt`), data)
  console.log(`File ${name} created.`)
}

async function file (name) {
  const isDir = await isDirectory(name.toLowerCase())
  if (!isDir) {
    const file = files.find((file) => {
      return file.name === name.toLowerCase()
    })
    if (typeof file !== 'undefined' && file) {
      return path.join(__dirname, `../fixtures/${file.name}.txt`)
    } else {
      if (name.includes(`/`)) {
        return path.join(__dirname, `../fixtures/${name.toLowerCase()}`)
      } else {
        return file
      }
    }
  } else {
    const arr = await fsReadDir(path.join(__dirname, `../fixtures/${name.toLowerCase()}`))
    const fullPath = arr.map((fileName) => {
      return path.join(__dirname, `../fixtures/${name.toLowerCase()}/${fileName.toLowerCase()}`)
    })
    return fullPath
  }
}

async function isDirectory (name) {
  try {
    const dir = path.join(__dirname, `../fixtures/${name.toLowerCase()}`)
    const stats = await fsStat(dir)
    return stats.isDirectory()
  } catch (e) {
    return false
  }
}

async function verifyTestFiles () {
  const fixtures = path.join(__dirname, `../fixtures`)
  try {
    await fsExists(fixtures)
  } catch (e) {
    await fsMakeDir(fixtures)
  }
  for (let f of files) {
    if (f.count) {
      console.log(`Verifying Directory ${f.name}`)
      const dir = await isDirectory(f.name)
      if (dir) {
        const fileArr = file(f.name)
        if (fileArr.length < f.count) {
          console.log(`Missing files in directory ${f.name}`)
          return false
        }
      } else {
        console.log(`Missing directory ${f.name}`)
        return false
      }
    } else {
      const filePath = await file(f.name)
      try {
        console.log(`Verifying File ${f.name}`)
        await fsExists(filePath)
      } catch (err) {
        console.log(`Missing ${f.name}`)
        return false
      }
    }
  }
  return true
}

module.exports = { generateFiles, verifyTestFiles, files }
