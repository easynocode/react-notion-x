import * as types from 'notion-types'
import { getTextContent } from './get-text-content'

export interface TableOfContentsEntry {
  id: types.ID
  type: types.BlockType
  text: string
  indentLevel: number
}

const indentLevels = {
  header: 0,
  sub_header: 1,
  sub_sub_header: 2
}

/**
 * Gets the metadata for a table of contents block by parsing the page's
 * H1, H2, and H3 elements.
 */
export const getPageTableOfContents = (
  page: types.PageBlock,
  recordMap: types.ExtendedRecordMap
): Array<TableOfContentsEntry> => {
  const tocInitial = (page?.content ?? [])
    .map((blockId: string) => {
      const block = recordMap.block[blockId]?.value

      if (block) {
        const { type } = block
        if (type === 'transclusion_reference') {
          const referencePointerId =
            block?.format?.transclusion_reference_pointer?.id

          if (!referencePointerId) {
            return null
          }
          const syncedBlock = recordMap.block[referencePointerId]?.value
          const toc2 = getPageTableOfContents(syncedBlock as any, recordMap)
          return toc2
        }

        if (
          type === 'header' ||
          type === 'sub_header' ||
          type === 'sub_sub_header'
        ) {
          return {
            id: blockId,
            type,
            text: getTextContent(block.properties?.title),
            indentLevel: indentLevels[type]
          }
        }
      }

      return null
    })
    .filter(Boolean) as Array<TableOfContentsEntry | TableOfContentsEntry[]>

  const toc: Array<TableOfContentsEntry> = []

  tocInitial.forEach((t) => {
    if (Array.isArray(t)) {
      toc.push(...t)
    } else {
      toc.push(t)
    }
  })

  const indentLevelStack = [
    {
      actual: -1,
      effective: -1
    }
  ]

  // Adjust indent levels to always change smoothly.
  // This is a little tricky, but the key is that when increasing indent levels,
  // they should never jump more than one at a time.
  for (const tocItem of toc) {
    const { indentLevel } = tocItem
    const actual = indentLevel

    do {
      const prevIndent = indentLevelStack[indentLevelStack.length - 1]
      const { actual: prevActual, effective: prevEffective } = prevIndent

      if (actual > prevActual) {
        tocItem.indentLevel = prevEffective + 1
        indentLevelStack.push({
          actual,
          effective: tocItem.indentLevel
        })
      } else if (actual === prevActual) {
        tocItem.indentLevel = prevEffective
        break
      } else {
        indentLevelStack.pop()
      }

      // eslint-disable-next-line no-constant-condition
    } while (true)
  }

  return toc
}
