// GitHub Pages has no rewrite rules. Serving index.html as 404.html makes deep links such as
// /osm-lanes/way/123 load the app, which then reads the way ID from the path.
import { copyFile } from 'node:fs/promises'
await copyFile(new URL('../_site/index.html', import.meta.url), new URL('../_site/404.html', import.meta.url))
console.log('_site/404.html written')
