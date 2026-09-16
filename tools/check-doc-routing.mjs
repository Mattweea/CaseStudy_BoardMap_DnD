import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDirectory = 'Docs/ai';
const macroRouter = 'Docs/ai/documentation_context_router.md';
const agentsFile = 'AGENTS.md';
const errors = [];

function toRepositoryPath(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join('/');
}

async function inventoryFiles(directory) {
  const files = new Map();
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = toRepositoryPath(absolutePath);
    const stats = await lstat(absolutePath);

    if (stats.isSymbolicLink()) {
      errors.push(`Symbolic links are not allowed under ${docsDirectory}: ${relativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      const descendants = await inventoryFiles(absolutePath);
      descendants.forEach((value, key) => files.set(key, value));
    } else if (entry.isFile()) {
      files.set(relativePath, absolutePath);
    }
  }

  return files;
}

function maskPreservingNewlines(value) {
  return value.replace(/[^\r\n]/gu, ' ');
}

function maskMarkdownCode(markdown) {
  let masked = markdown.replace(/<!--[\s\S]*?-->/gu, maskPreservingNewlines);
  const lines = masked.split(/(\r\n|\n|\r)/u);
  let fenceCharacter = null;
  let minimumFenceLength = 0;

  masked = lines
    .map((line) => {
      if (line === '\n' || line === '\r' || line === '\r\n') {
        return line;
      }

      const opening = fenceCharacter === null ? line.match(/^ {0,3}(`{3,}|~{3,})/u) : null;
      if (opening) {
        fenceCharacter = opening[1][0];
        minimumFenceLength = opening[1].length;
        return ' '.repeat(line.length);
      }

      if (fenceCharacter !== null) {
        const closingPattern = new RegExp(
          `^ {0,3}${fenceCharacter}{${minimumFenceLength},}[ \\t]*$`,
          'u',
        );
        const isClosing = closingPattern.test(line);
        const result = ' '.repeat(line.length);
        if (isClosing) {
          fenceCharacter = null;
          minimumFenceLength = 0;
        }
        return result;
      }

      return line;
    })
    .join('');

  return masked.replace(/(?<!`)(`+)(?!`)([\s\S]*?)\1(?!`)/gu, maskPreservingNewlines);
}

function extractMarkdownLinks(markdown) {
  const masked = maskMarkdownCode(markdown);
  const pattern = /(?<!\\)(?<image>!)?\[(?:\\.|[^\]\\\r\n])*\]\(\s*(?:<(?<angle>[^>\r\n]+)>|(?<plain>(?:\\.|[^()\s])+))(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^\)\r\n]*\)))?\s*\)/gu;
  const links = [];

  for (const match of masked.matchAll(pattern)) {
    const destination = (match.groups?.angle ?? match.groups?.plain ?? '').replace(/\\([^\p{L}\p{N}])/gu, '$1');
    const offset = match.index ?? 0;
    links.push({
      destination,
      image: match.groups?.image === '!',
      line: masked.slice(0, offset).split(/\r\n|\n|\r/u).length,
    });
  }

  return links;
}

function splitOnce(value, separator) {
  const index = value.indexOf(separator);
  return index === -1
    ? [value, '']
    : [value.slice(0, index), value.slice(index + separator.length)];
}

function normalizeTarget(source, target) {
  const sourceDirectory = path.posix.dirname(source);
  const normalized = path.posix.normalize(path.posix.join(sourceDirectory, target || path.posix.basename(source)));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    return null;
  }
  return normalized;
}

function headingSlug(heading) {
  return heading
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/`+([^`]*)`+/gu, '$1')
    .replace(/<[^>]*>/gu, '')
    .replace(/\\([^\p{L}\p{N}])/gu, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/gu, '-');
}

function extractAnchors(markdown) {
  const anchors = new Set();
  const usedSlugs = new Map();
  const masked = maskMarkdownCode(markdown);

  for (const match of masked.matchAll(/\b(?:id|name)\s*=\s*(["'])(?<anchor>.*?)\1/giu)) {
    if (match.groups?.anchor) {
      anchors.add(match.groups.anchor);
    }
  }

  const lines = masked.split(/\r\n|\n|\r/u);
  let previousLine = null;
  for (const line of lines) {
    const atx = line.match(/^ {0,3}#{1,6}(?:[ \t]+|$)(.*)$/u);
    const setext = previousLine !== null && /^ {0,3}(?:=+|-+)[ \t]*$/u.test(line);
    const heading = atx
      ? atx[1].replace(/[ \t]+#+[ \t]*$/u, '')
      : setext
        ? previousLine.trim()
        : null;

    if (heading !== null) {
      const baseSlug = headingSlug(heading);
      if (baseSlug) {
        const count = usedSlugs.get(baseSlug) ?? 0;
        anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
        usedSlugs.set(baseSlug, count + 1);
      }
    }
    previousLine = line;
  }

  return anchors;
}

function isRouter(filePath) {
  return filePath === macroRouter || path.posix.basename(filePath).endsWith('_context_router.md');
}

function isDocsPath(filePath) {
  return filePath === docsDirectory || filePath.startsWith(`${docsDirectory}/`);
}

function linkError(source, link, reason) {
  const destination = link.destination || '(empty)';
  return `${source}:${link.line} -> ${destination} (${reason})`;
}

const docsRoot = path.join(repositoryRoot, docsDirectory);
let docsFiles = new Map();
try {
  docsFiles = await inventoryFiles(docsRoot);
} catch (error) {
  errors.push(`Unable to inventory ${docsDirectory}: ${error.message}`);
}

if (!docsFiles.has(macroRouter)) {
  errors.push(`Missing macro-router: ${macroRouter}`);
}

const markdownSources = new Map(
  [...docsFiles.entries()].filter(([filePath]) => filePath.toLowerCase().endsWith('.md')),
);
markdownSources.set(agentsFile, path.join(repositoryRoot, agentsFile));

const resolvedLinks = new Map();
const anchorCache = new Map();

for (const [source, absolutePath] of [...markdownSources.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  let markdown;
  try {
    markdown = await readFile(absolutePath, 'utf8');
  } catch (error) {
    errors.push(`Unable to read ${source}: ${error.message}`);
    continue;
  }

  for (const link of extractMarkdownLinks(markdown)) {
    const destination = link.destination.trim();
    if (destination.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(destination) || destination.startsWith('/')) {
      if (destination.toLowerCase().startsWith('file:')) {
        errors.push(linkError(source, link, 'file: links are not allowed'));
      }
      continue;
    }

    const [pathAndQuery, encodedFragment] = splitOnce(destination, '#');
    const [encodedPath] = splitOnce(pathAndQuery, '?');
    let decodedPath;
    let fragment;
    try {
      decodedPath = decodeURIComponent(encodedPath);
      fragment = decodeURIComponent(encodedFragment);
    } catch {
      errors.push(linkError(source, link, 'invalid percent encoding'));
      continue;
    }

    if (decodedPath.includes('\\')) {
      errors.push(linkError(source, link, 'use forward slashes in Markdown links'));
      continue;
    }

    const target = normalizeTarget(source, decodedPath);
    if (target === null) {
      errors.push(linkError(source, link, 'target escapes the repository'));
      continue;
    }

    const targetAbsolutePath = path.join(repositoryRoot, target);
    try {
      const stats = await lstat(targetAbsolutePath);
      if (!stats.isFile()) {
        throw new Error('not a file');
      }
    } catch {
      errors.push(linkError(source, link, `missing target ${target}`));
      continue;
    }

    if (fragment && target.toLowerCase().endsWith('.md')) {
      if (!anchorCache.has(target)) {
        anchorCache.set(target, extractAnchors(await readFile(targetAbsolutePath, 'utf8')));
      }
      if (!anchorCache.get(target).has(fragment)) {
        errors.push(linkError(source, link, `missing anchor #${fragment} in ${target}`));
        continue;
      }
    }

    const sourceLinks = resolvedLinks.get(source) ?? [];
    sourceLinks.push({ target, image: link.image, line: link.line });
    resolvedLinks.set(source, sourceLinks);
  }
}

if (docsFiles.has(macroRouter)) {
  const reachable = new Set([macroRouter]);
  const visitedRouters = new Set();
  const queue = [macroRouter];

  while (queue.length > 0) {
    const router = queue.shift();
    if (visitedRouters.has(router)) {
      continue;
    }
    visitedRouters.add(router);

    for (const link of resolvedLinks.get(router) ?? []) {
      if (link.image || !docsFiles.has(link.target)) {
        continue;
      }
      reachable.add(link.target);
      if (isRouter(link.target) && !visitedRouters.has(link.target)) {
        queue.push(link.target);
      }
    }
  }

  for (const artifact of docsFiles.keys()) {
    if (!reachable.has(artifact)) {
      errors.push(`Unreachable documentation artifact: ${artifact}`);
    }
  }
}

for (const filePath of docsFiles.keys()) {
  const basename = path.posix.basename(filePath);
  if (basename.includes('context_router') && !basename.endsWith('_context_router.md')) {
    errors.push(`Invalid router filename: ${filePath}`);
  }
}

try {
  const agents = await readFile(path.join(repositoryRoot, agentsFile), 'utf8');
  if (!agents.includes(macroRouter)) {
    errors.push(`${agentsFile} must point to ${macroRouter}`);
  }

  const pathMatches = agents.match(/Docs\/ai(?:\/[^\s`"'<>\])},;:]+)+/gu) ?? [];
  for (const match of pathMatches) {
    const candidate = splitOnce(splitOnce(match.replace(/[.]$/u, ''), '#')[0], '?')[0];
    if (candidate !== macroRouter) {
      errors.push(`${agentsFile} contains a documentation route other than the macro-router: ${candidate}`);
    }
  }

  for (const link of resolvedLinks.get(agentsFile) ?? []) {
    if (isDocsPath(link.target) && link.target !== macroRouter) {
      errors.push(`${agentsFile} links directly to documentation route ${link.target}`);
    }
  }
} catch (error) {
  errors.push(`Missing or unreadable ${agentsFile}: ${error.message}`);
}

const uniqueErrors = [...new Set(errors)].sort();
if (uniqueErrors.length > 0) {
  console.error('Documentation routing check failed:');
  uniqueErrors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Documentation routing check passed: ${docsFiles.size} artifacts are reachable from ${macroRouter}.`,
  );
}
