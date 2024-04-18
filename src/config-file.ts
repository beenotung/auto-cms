import { readFileSync, writeFileSync } from 'fs'

export function setupConfigFile() {
  let file = '.gitignore'
  let text = ''
  try {
    text = readFileSync(file).toString()
  } catch (error) {
    // file not exist
  }
  let lines = text
    .trim()
    .split('\n')
    .map(line => line.trim())
  let patterns = ['.env', '*_bk*.*']
  for (let pattern of patterns) {
    if (!lines.includes(pattern)) {
      lines.push(pattern)
    }
  }
  let newText = lines.join('\n') + '\n'
  if (text != newText) {
    writeFileSync(file, newText)
  }
}
