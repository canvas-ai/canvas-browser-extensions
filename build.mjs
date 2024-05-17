import archiver from 'archiver'
import autoprefixer from 'autoprefixer'
import * as dotenv from 'dotenv'
import esbuild from 'esbuild'
import postcssPlugin from 'esbuild-style-plugin'
import fs from 'fs-extra'
import process from 'node:process'
import tailwindcss from 'tailwindcss'
import path from 'path'

dotenv.config()

const outdir = 'build'
const packagesDir = 'packages'
const appName = 'test'

const isDev = process.env.NODE_ENV === 'dev'

let buildConfig = {
  entryPoints: [
    'src/background/index.ts',
    'src/content-script/index.ts',
    'src/popup/index.tsx',
  ],
  bundle: true,
  outdir: outdir,
  treeShaking: true,
  minify: true,
  drop: ['console', 'debugger'],
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  jsx: 'automatic',
  loader: {
    '.gif': 'dataurl',
    '.png': 'dataurl',
    '.svg': 'dataurl',
    '.woff2': 'file',
    '.woff': 'file'
  },
  plugins: [
    postcssPlugin({
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    }),
  ],
}

if (isDev) {
  buildConfig = { ...buildConfig, ...{ minify: false, drop: [] } }
}

async function deleteOldDir() {
  await fs.remove(outdir)
}

async function runEsbuild() {
  await esbuild.build(buildConfig)
}

async function zipFolder(dir) {
  const output = fs.createWriteStream(`${dir}.zip`)
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })
  archive.pipe(output)
  archive.directory(dir, false)
  await archive.finalize()
}

async function copyFiles(entryPoints, targetDir) {
  await fs.ensureDir(targetDir)
  await Promise.all(
    entryPoints.map(async (entryPoint) => {
      await fs.copy(entryPoint.src, `${targetDir}/${entryPoint.dst}`)
    }),
  )
}

function copyDirectoryContent(source = 'public', destination = 'build') {
  try {
    // Get list of files and directories in source directory
    const items = fs.readdirSync(source);

    // Loop through each item
    for (const item of items) {
      // Get the full path of the item
      const itemPath = path.join(source, item);

      // Get the stats of the item
      const stats = fs.statSync(itemPath);

      // Determine if the item is a file or directory
      if (stats.isFile()) {
        // If it's a file, copy it to the destination directory
        fs.copyFileSync(itemPath, path.join(destination, item));
      } else if (stats.isDirectory()) {
        // If it's a directory, create it in the destination directory
        fs.ensureDirSync(path.join(destination, item));

        // Recursively copy files in the subdirectory
        copyDirectoryContent(itemPath, path.join(destination, item));
      }
    }
  } catch (err) {
    console.error('Error copying files:', err);
  }
}

async function exportForBrowser(browser) {
  const commonFiles = [
    { src: 'build/background/index.js', dst: 'background.js' },
    { src: 'build/content-script/index.js', dst: 'content-script.js' },
    { src: 'src/popup/index.html', dst: 'popup/popup.html' },
    { src: 'build/popup/index.js', dst: 'popup/popup.js' },
    { src: 'build/popup/index.css', dst: 'popup/popup.css' },
    // { src: 'src/assets/16.png', dst: '16.png' },
    // { src: 'src/assets/48.png', dst: '48.png' },
    // { src: 'src/assets/128.png', dst: '128.png' },
    // { src: 'src/assets/240.png', dst: '240.png' },
  ]

  await copyFiles(
    [...commonFiles, { src: `src/manifest-${browser}.json`, dst: 'manifest.json' }],
    `./${outdir}/${browser}`,
  )

  copyDirectoryContent('public', path.join('build', browser, 'popup'));

  await zipFolder(`./${outdir}/${browser}`)
  await copyFiles(
    [
      {
        src: `${outdir}/${browser}.zip`,
        dst: `${appName}${browser}.zip`,
      },
    ],
    `./${packagesDir}`,
  )

  await copyFiles(
    [
      {
        src: `${outdir}/${browser}`,
        dst: `./${browser}`,
      },
    ],
    `./${packagesDir}`,
  )
}

async function build() {
  await deleteOldDir()
  await runEsbuild()

  // chromium
  await exportForBrowser('chromium');

  // firefox
  await exportForBrowser('firefox');

  console.log('Build success.')
}

build()
