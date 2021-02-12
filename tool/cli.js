const fs = require("fs");
const path = require("path");
const os = require("os");

const program = require("@caporal/core").default;
const chalk = require("chalk");
const { prompt } = require("inquirer");
const openEditor = require("open-editor");
const open = require("open");

const { DEFAULT_LOCALE, VALID_LOCALES } = require("../libs/constants");
const {
  CONTENT_ROOT,
  CONTENT_TRANSLATED_ROOT,
  CONTENT_ARCHIVED_ROOT,
  Redirect,
  Document,
  buildURL,
} = require("../content");
const { buildDocument, gatherGitHistory } = require("../build");
const { runMakePopularitiesFile } = require("./popularities");

const PORT = parseInt(process.env.SERVER_PORT || "5000");

// The Google Analytics pageviews CSV file parsed, sorted (most pageviews
// first), and sliced to this number of URIs that goes into the JSON file.
// If this number is too large the resulting JSON file gets too big and
// will include very rarely used URIs.
const MAX_GOOGLE_ANALYTICS_URIS = 20000;

function tryOrExit(f) {
  return async ({ options = {}, ...args }) => {
    try {
      await f({ options, ...args });
    } catch (error) {
      if (options.verbose || options.v) {
        console.error(chalk.red(error.stack));
      }
      throw error;
    }
  };
}

program
  .bin("yarn tool")
  .name("tool")
  .version("0.0.0")
  .disableGlobalOption("--silent")
  .command("validate-redirects", "Check the _redirects.txt file(s)")
  .action(
    tryOrExit(({ logger }) => {
      Redirect.load(null, true);
      logger.info(chalk.green("🍾 All is well in the world of redirects 🥂"));
    })
  )

  .command("test-redirects", "Test URLs (pathnames) to see if they redirect")
  .argument("[urls...]", "URLs to test")
  .action(
    tryOrExit(({ args, logger }) => {
      for (const url of args.urls) {
        const resolved = Redirect.resolve(url);
        if (resolved === url) {
          logger.info(chalk.yellow(`${url.padEnd(50)} Not a redirecting URL`));
        } else {
          logger.info(chalk.green(`${url.padEnd(50)} -> ${resolved}`));
        }
      }
    })
  )

  .command("add-redirect", "Add a new redirect")
  .argument("<from>", "From-URL", {
    validator: (value) => {
      Redirect.validateFromURL(value);
      return value;
    },
  })
  .argument("<to>", "To-URL", {
    validator: (value) => {
      Redirect.validateToURL(value);
      return value;
    },
  })
  .action(
    tryOrExit(({ args, logger }) => {
      const { from, to } = args;
      const locale = from.split("/")[1];
      Redirect.add(locale, [[from, to]]);
      logger.info(chalk.green(`Saved '${from}' → '${to}'`));
    })
  )

  .command("fix-redirects", "Consolidate/fix redirects")
  .argument("<locale...>", "Locale", {
    default: [DEFAULT_LOCALE],
    validator: [...VALID_LOCALES.values(), ...VALID_LOCALES.keys()],
  })
  .action(
    tryOrExit(({ args, logger }) => {
      const { locale } = args;
      for (const l of locale) {
        Redirect.add(l.toLowerCase(), [], { fix: true });
        logger.info(chalk.green(`Fixed ${l}`));
      }
    })
  )

  .command("delete", "Delete content")
  .argument("<slug>", "Slug")
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .option("-r, --recursive", "Delete content recursively", { default: false })
  .option("--redirect <redirect>", "Redirect document to <redirect>")
  .option("-y, --yes", "Assume yes", { default: false })
  .action(
    tryOrExit(async ({ args, options }) => {
      const { slug, locale } = args;
      const { recursive, redirect, yes } = options;
      const changes = Document.remove(slug, locale, {
        recursive,
        redirect,
        dry: true,
      });
      console.log(chalk.green(`Will remove ${changes.length} documents:`));
      console.log(chalk.red(changes.join("\n")));
      if (redirect) {
        console.log(chalk.green(`redirecting to: ${redirect}`));
      }
      const { run } = yes
        ? { run: true }
        : await prompt({
            type: "confirm",
            message: "Proceed?",
            name: "run",
            default: true,
          });
      if (run) {
        const removed = Document.remove(slug, locale, { recursive, redirect });
        console.log(chalk.green(`Moved ${removed.length} documents.`));
      }
    })
  )

  .command("move", "Move content to a new slug")
  .argument("<oldSlug>", "Old slug")
  .argument("<newSlug>", "New slug", {
    validator: (value) => {
      if (value.includes("#")) {
        throw new Error("slug can not contain the '#' character");
      }
      return value;
    },
  })
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .option("-y, --yes", "Assume yes", { default: false })
  .action(
    tryOrExit(async ({ args, options }) => {
      const { oldSlug, newSlug, locale } = args;
      const { yes } = options;
      const changes = Document.move(oldSlug, newSlug, locale, {
        dry: true,
      });
      console.log(
        chalk.green(
          `Will move ${changes.length} documents from ${oldSlug} to ${newSlug} for ${locale}`
        )
      );
      console.log(
        changes
          .map(([from, to]) => `${chalk.red(from)} → ${chalk.green(to)}`)
          .join("\n")
      );
      const { run } = yes
        ? { run: true }
        : await prompt({
            type: "confirm",
            message: "Proceed?",
            name: "run",
            default: true,
          });
      if (run) {
        const moved = Document.move(oldSlug, newSlug, locale);
        console.log(chalk.green(`Moved ${moved.length} documents.`));
      }
    })
  )

  .command("edit", "Spawn your EDITOR for an existing slug")
  .argument("<slug>", "Slug of the document in question")
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .action(
    tryOrExit(({ args }) => {
      const { slug, locale } = args;
      if (!Document.exists(slug, locale)) {
        throw new Error(`${slug} does not exists for ${locale}`);
      }
      const filePath = Document.fileForSlug(slug, locale);
      openEditor([filePath]);
    })
  )

  .command("create", "Spawn your Editor for a new slug")
  .argument("<slug>", "Slug of the document in question")
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .action(
    tryOrExit(({ args }) => {
      const { slug, locale } = args;
      const parentSlug = Document.parentSlug(slug);
      if (!Document.exists(parentSlug, locale)) {
        throw new Error(`Parent ${parentSlug} does not exists for ${locale}`);
      }
      if (Document.exists(slug, locale)) {
        throw new Error(`${slug} already exists for ${locale}`);
      }
      const filePath = Document.fileForSlug(slug, locale);
      fs.mkdirSync(path.basename(filePath), { recursive: true });
      openEditor([filePath]);
    })
  )

  .command("validate", "Validate a document")
  .argument("<slug>", "Slug of the document in question")
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .action(
    tryOrExit(async ({ args }) => {
      const { slug, locale } = args;
      let okay = true;
      const document = Document.findByURL(buildURL(locale, slug));
      if (!document) {
        throw new Error(`Slug ${slug} does not exist for ${locale}`);
      }
      const { doc } = await buildDocument(document);

      const flaws = Object.values(doc.flaws || {})
        .map((a) => a.length || 0)
        .reduce((a, b) => a + b, 0);
      if (flaws > 0) {
        console.log(chalk.red(`Found ${flaws} flaws.`));
        okay = false;
      }
      try {
        Document.validate(slug, locale);
      } catch (e) {
        console.log(chalk.red(e));
        okay = false;
      }
      if (okay) {
        console.log(chalk.green("✓ All seems fine"));
      }
    })
  )

  .command("preview", "Open a preview of a slug")
  .option("-p, --port <port>", "Port for your localhost hostname", {
    default: PORT,
  })
  .option("-h, --hostname <hostname>", "Hostname for your local server", {
    default: "localhost",
  })
  .argument("<slug>", "Slug (or path) of the document in question")
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .action(
    tryOrExit(async ({ args, options }) => {
      const { slug, locale } = args;
      const { hostname, port } = options;
      let url;
      // Perhaps they typed in a path relative to the content root
      if (slug.startsWith("files") && slug.endsWith("index.html")) {
        const document = Document.read(
          slug.split(path.sep).slice(1, -1).join(path.sep)
        );
        if (document) {
          url = document.url;
        }
      } else {
        try {
          const parsed = new URL(slug);
          url = parsed.pathname + parsed.hash;
        } catch (err) {
          // If the `new URL()` constructor fails, it's probably not a URL
        }
        if (!url) {
          url = buildURL(locale, slug);
        }
      }

      if (!url) {
        throw new Error(`Unable to turn '${slug}' into an absolute URL`);
      }
      const absoluteURL = `http://${hostname}:${port}${url}`;
      await open(absoluteURL);
    })
  )

  .command(
    "gather-git-history",
    "Extract all last-modified dates from the git logs"
  )
  .option("--root <directory>", "Which content root", {
    default: CONTENT_ROOT,
  })
  .option("--save-history <path>", `File to save all previous history`, {
    default: path.join(os.tmpdir(), "yari-git-history.json"),
  })
  .option(
    "--load-history <path>",
    `Optional file to load all previous history`,
    {
      default: path.join(os.tmpdir(), "yari-git-history.json"),
    }
  )
  .action(
    tryOrExit(async ({ options }) => {
      const { root, saveHistory, loadHistory } = options;
      if (fs.existsSync(loadHistory)) {
        console.log(
          chalk.yellow(`Reusing existing history from ${loadHistory}`)
        );
      }
      const map = gatherGitHistory(
        root,
        fs.existsSync(loadHistory) ? loadHistory : null
      );
      const historyPerLocale = {};

      // Someplace to put the map into an object so it can be saved into `saveHistory`
      const allHistory = {};
      for (const [relPath, value] of map) {
        allHistory[relPath] = value;
        const locale = relPath.split("/")[0];
        if (!historyPerLocale[locale]) {
          historyPerLocale[locale] = {};
        }
        historyPerLocale[locale][relPath] = value;
      }
      for (const [locale, history] of Object.entries(historyPerLocale)) {
        const outputFile = path.join(root, locale, "_githistory.json");
        fs.writeFileSync(outputFile, JSON.stringify(history, null, 2), "utf-8");
        console.log(
          chalk.green(
            `Wrote '${locale}' ${Object.keys(
              history
            ).length.toLocaleString()} paths into ${outputFile}`
          )
        );
      }
      fs.writeFileSync(
        saveHistory,
        JSON.stringify(allHistory, null, 2),
        "utf-8"
      );
      console.log(
        chalk.green(
          `Saved ${Object.keys(
            allHistory
          ).length.toLocaleString()} paths into ${saveHistory}`
        )
      );
    })
  )

  .command("flaws", "Find (and fix) flaws in a document")
  .argument("<slug>", "Slug of the document in question")
  .argument("[locale]", "Locale", {
    default: DEFAULT_LOCALE,
    validator: [...VALID_LOCALES.values()],
  })
  .option("-y, --yes", "Assume yes", { default: false })
  .action(
    tryOrExit(async ({ args, options }) => {
      const { slug, locale } = args;
      const { yes } = options;
      const document = Document.findByURL(buildURL(locale, slug));
      if (!document) {
        throw new Error(`Slug ${slug} does not exist for ${locale}`);
      }
      const { doc } = await buildDocument(document, {
        fixFlaws: true,
        fixFlawsDryRun: true,
      });

      const flaws = Object.values(doc.flaws || {})
        .map((a) => a.filter((f) => f.fixable).length || 0)
        .reduce((a, b) => a + b, 0);
      if (flaws === 0) {
        console.log(chalk.green("Found no fixable flaws!"));
        return;
      }
      const { run } = yes
        ? { run: true }
        : await prompt({
            type: "confirm",
            message: `Proceed fixing ${flaws} flaws?`,
            name: "run",
            default: true,
          });
      if (run) {
        buildDocument(document, { fixFlaws: true, fixFlawsVerbose: true });
      }
    })
  )

  .command("redundant-translations", "Find redundant translations")
  .action(
    tryOrExit(async () => {
      if (!CONTENT_TRANSLATED_ROOT) {
        throw new Error("CONTENT_TRANSLATED_ROOT not set");
      }
      if (!fs.existsSync(CONTENT_TRANSLATED_ROOT)) {
        throw new Error(`${CONTENT_TRANSLATED_ROOT} does not exist`);
      }
      const documents = Document.findAll();
      if (!documents.count) {
        throw new Error("No documents to analyze");
      }
      // Build up a map of translations by their `translation_of`
      const map = new Map();
      for (const document of documents.iter()) {
        if (!document.isTranslated) continue;
        const { translation_of, locale } = document.metadata;
        if (!map.has(translation_of)) {
          map.set(translation_of, new Map());
        }
        if (!map.get(translation_of).has(locale)) {
          map.get(translation_of).set(locale, []);
        }
        map
          .get(translation_of)
          .get(locale)
          .push(
            Object.assign(
              { filePath: document.fileInfo.path },
              document.metadata
            )
          );
      }
      // Now, let's investigate those with more than 1
      let sumENUS = 0;
      let sumTotal = 0;
      for (const [translation_of, localeMap] of map) {
        for (const [, metadatas] of localeMap) {
          if (metadatas.length > 1) {
            // console.log(translation_of, locale, metadatas);
            sumENUS++;
            sumTotal += metadatas.length;
            console.log(
              `https://developer.allizom.org/en-US/docs/${translation_of}`
            );
            for (const metadata of metadatas) {
              console.log(metadata);
            }
          }
        }
      }
      console.warn(
        `${sumENUS} en-US documents have multiple translations with the same locale`
      );
      console.log(
        `In total, ${sumTotal} translations that share the same translation_of`
      );
    })
  )

  .command(
    "unarchive",
    "Move content from CONTENT_ARCHIVED_ROOT to CONTENT_ROOT"
  )
  .option("--foldersearch <pattern>", "simple pattern for folders", {
    default: "",
  })
  .option("--move", "(git) delete from archive repo", { default: false })
  .argument("[files...]", "specific files")
  .action(
    tryOrExit(async ({ args, options }) => {
      if (!CONTENT_ARCHIVED_ROOT) {
        throw new Error("CONTENT_ARCHIVED_ROOT not set");
      }
      if (!CONTENT_TRANSLATED_ROOT) {
        throw new Error("CONTENT_TRANSLATED_ROOT not set");
      }
      const { files } = args;
      const { foldersearch, move } = options;
      if (!foldersearch && !files) {
        throw new Error("Must specify either files or --foldersearch pattern");
      }
      const filters = {
        folderSearch: foldersearch || null,
        files: new Set(files || []),
      };
      const documents = Document.findAll(filters);
      if (!documents.count) {
        throw new Error("No documents found");
      }
      let countCreated = 0;
      for (const document of documents.iter()) {
        console.assert(document.isArchive, document.fileInfo);
        console.assert(!document.isTranslated, document.fileInfo);
        if (document.metadata.locale !== "en-US") {
          continue;
        }
        const created = Document.unarchive(document, move);
        console.log(`Created ${created}`);
        countCreated++;
      }
      console.log(`Created ${countCreated} new files`);
    })
  )

  .command(
    "popularities",
    "Convert a Google Analytics pageviews CSV into a popularities.json file"
  )
  .option(
    "--outfile <path>",
    "export from Google Analytics containing pageview counts",
    {
      default: path.join(CONTENT_ROOT, "popularities.json"),
    }
  )
  .option(
    "--max-uris <number>",
    "export from Google Analytics containing pageview counts",
    {
      default: MAX_GOOGLE_ANALYTICS_URIS,
    }
  )
  .argument("csvfile", "Google Analytics pageviews CSV file", {
    validator: (value) => {
      if (!fs.existsSync(value)) {
        throw new Error(`${value} does not exist`);
      }
      return value;
    },
  })
  .action(
    tryOrExit(async ({ args, options, logger }) => {
      const {
        rowCount,
        popularities,
        pageviews,
      } = await runMakePopularitiesFile(args.csvfile, options);
      logger.info(chalk.green(`Parsed ${rowCount.toLocaleString()} rows.`));

      const numberKeys = Object.keys(popularities).length;
      logger.info(
        chalk.green(`Wrote ${numberKeys.toLocaleString()} pages' popularities.`)
      );

      logger.debug("25 most popular URIs...");
      pageviews.slice(0, 25).forEach(([uri, popularity], i) => {
        logger.debug(
          `${`${i}`.padEnd(2)} ${uri.padEnd(75)} ${popularity.toFixed(5)}`
        );
      });
      function fmtBytes(bytes) {
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
      }
      logger.info(
        chalk.green(
          `${options.outfile} is ${fmtBytes(fs.statSync(options.outfile).size)}`
        )
      );
    })
  );

program.run();
