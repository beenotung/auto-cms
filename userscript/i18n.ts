// CJK range: 4E00–9FFF
let cjk_min_char = String.fromCharCode(parseInt('4E00', 16))
let cjk_max_char = String.fromCharCode(parseInt('9FFF', 16))

let allowedSymbols = ',.!?;，。！？；'

export function isSymbol(char: string): boolean {
  if ('a' <= char && char <= 'z') return false
  if ('A' <= char && char <= 'Z') return false
  if (cjk_min_char <= char && char <= cjk_max_char) return false
  if (allowedSymbols.includes(char)) return false
  return true
}

export function wrapText(text: string): false | string {
  let chars: string[] = []
  for (let char of text) {
    chars.push(char)
  }

  let start_index = chars.findIndex(char => !isSymbol(char))
  if (start_index == -1) return false

  let end_index = text.length
  for (; end_index > start_index; end_index--) {
    if (!isSymbol(chars[end_index - 1])) {
      break
    }
  }
  let mid = chars.slice(start_index, end_index).join('')
  if (
    !mid
      .split('')
      .some(char => !allowedSymbols.includes(char) && !isSymbol(char))
  ) {
    return false
  }
  let before = chars.slice(0, start_index).join('')
  let after = chars.slice(end_index).join('')
  return before + '{{' + mid + '}}' + after
}
