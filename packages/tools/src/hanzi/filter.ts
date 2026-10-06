export function filterNonChineseChars(input: string) {
  return Array.from(input)
    .filter(i => /\p{Unified_Ideograph}/u.test(i))
    .join('')
}

