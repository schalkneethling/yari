const {
  CONTENT_ROOT,
  CONTENT_ARCHIVED_ROOT,
  CONTENT_TRANSLATED_ROOT,
  REPOSITORY_URLS,
  ROOTS,
  VALID_LOCALES,
} = require("./constants");
const Document = require("./document");
const { getPopularities } = require("./popularities");
const Redirect = require("./redirect");
const Image = require("./image");
const Archive = require("./archive");
const { buildURL, memoize, slugToFolder, execGit } = require("./utils");
const { resolveFundamental } = require("../libs/fundamental-redirects");

module.exports = {
  CONTENT_ROOT,
  CONTENT_ARCHIVED_ROOT,
  CONTENT_TRANSLATED_ROOT,
  REPOSITORY_URLS,
  ROOTS,
  VALID_LOCALES,

  getPopularities,

  Document,
  Redirect,
  Image,
  Archive,

  buildURL,
  memoize,
  slugToFolder,
  resolveFundamental,
  execGit,
};
