export function extractPadding(fullText: string, trimmedText: string) {
  let leading = ''
  let tailing = ''

  if (trimmedText.length > 0) {
    let index = fullText.indexOf(trimmedText[0])
    leading = fullText.substring(0, index)

    index = fullText.lastIndexOf(trimmedText[trimmedText.length - 1])
    tailing = fullText.substring(index + 1)
  }

  return { leading, tailing }
}
