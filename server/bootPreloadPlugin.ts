import type { HtmlTagDescriptor, Plugin, Rollup } from 'vite'

// The page's module entry is src/boot.ts: it fixes the language of the page load and
// only then imports src/main.ts dynamically (docs/i18n.md). Left alone, the browser
// would start fetching main (about 2 MB) and its stylesheet only after boot had run —
// and for English players only after the catalog chunk had arrived too. This build-only
// plugin links them from index.html instead, so they download in parallel with boot:
// `modulepreload` fetches and parses main without running it, and the stylesheet is a
// `preload`, not a blocking `stylesheet`, so the boot loader still paints at once. When
// boot imports main, Vite's preload helper finds both and reuses them.
export function bootPreload(entry = 'src/main.ts'): Plugin {
  let base = '/'
  return {
    name: 'festival-boot-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const bundle = context.bundle
        if (!bundle) return
        const chunks = Object.values(bundle).filter((output): output is Rollup.OutputChunk => output.type === 'chunk')
        const main = chunks.find((chunk) => chunk.facadeModuleId?.replace(/\\/g, '/').endsWith(`/${entry}`))
        if (!main) return
        const scripts = new Set<string>()
        const styles = new Set<string>()
        const visit = (chunk: Rollup.OutputChunk): void => {
          if (scripts.has(chunk.fileName) || chunk.isEntry) return
          scripts.add(chunk.fileName)
          for (const css of chunk.viteMetadata?.importedCss ?? []) styles.add(css)
          for (const name of chunk.imports) {
            const dependency = bundle[name]
            if (dependency?.type === 'chunk') visit(dependency)
          }
        }
        visit(main)
        const link = (attrs: Record<string, string | boolean>): HtmlTagDescriptor => ({ tag: 'link', attrs: { ...attrs, crossorigin: true }, injectTo: 'head' })
        return [
          ...[...scripts].map((file) => link({ rel: 'modulepreload', href: `${base}${file}` })),
          ...[...styles].map((file) => link({ rel: 'preload', as: 'style', href: `${base}${file}` })),
        ]
      },
    },
  }
}
