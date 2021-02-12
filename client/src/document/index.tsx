import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSWR, { mutate } from "swr";

import { CRUD_MODE } from "../constants";
import { useGA } from "../ga-context";
import { useDocumentURL } from "./hooks";
import { Doc } from "./types";
// Ingredients
import { Prose, ProseWithHeading } from "./ingredients/prose";
import { InteractiveExample } from "./ingredients/interactive-example";
import { Attributes } from "./ingredients/attributes";
import { Examples } from "./ingredients/examples";
import { LinkList, LinkLists } from "./ingredients/link-lists";
import { Specifications } from "./ingredients/specifications";
import { LazyBrowserCompatibilityTable } from "./lazy-bcd-table";

// Misc
// Sub-components
import { Breadcrumbs } from "../ui/molecules/breadcrumbs";
import { LanguageMenu } from "../ui/molecules/language-menu";
import { Titlebar } from "../ui/molecules/titlebar";
import { TOC } from "./organisms/toc";
import { RenderSideBar } from "./organisms/sidebar";
import { MainContentContainer } from "../ui/atoms/page-content";
import { Metadata } from "./organisms/metadata";

import { ReactComponent as Dino } from "../assets/dino.svg";

import "./index.scss";

// Lazy sub-components
const Toolbar = React.lazy(() => import("./toolbar"));

export function Document(props /* TODO: define a TS interface for this */) {
  const ga = useGA();
  const mountCounter = React.useRef(0);
  const documentURL = useDocumentURL();
  const { locale } = useParams();
  const navigate = useNavigate();

  const dataURL = `${documentURL}/index.json`;
  const { data: doc, error } = useSWR<Doc>(
    dataURL,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`${response.status} on ${url}: Page not found`);
        }
        const text = await response.text();
        throw new Error(`${response.status} on ${url}: ${text}`);
      }
      const { doc } = await response.json();
      if (response.redirected) {
        navigate(doc.mdn_url);
      }
      return doc;
    },
    {
      initialData:
        props.doc &&
        props.doc.mdn_url.toLowerCase() === documentURL.toLowerCase()
          ? props.doc
          : null,
      revalidateOnFocus: CRUD_MODE,
    }
  );

  React.useEffect(() => {
    if (!doc && !error) {
      document.title = "⏳ Loading…";
    } else if (error) {
      document.title = "💔 Loading error";
    } else if (doc) {
      document.title = doc.pageTitle;
    }
  }, [doc, error]);

  React.useEffect(() => {
    if (ga && doc && !error) {
      if (mountCounter.current > 0) {
        // 'dimension19' means it's a client-side navigation.
        // I.e. not the initial load but the location has now changed.
        // Note that in local development, where you use `localhost:3000`
        // this will always be true because it's always client-side navigation.
        ga("set", "dimension19", "Yes");
      }
      ga("send", {
        hitType: "pageview",
        location: window.location.toString(),
      });
      // By counting every time a document is mounted, we can use this to know if
      // a client-side navigation happened.
      mountCounter.current++;
    }
  }, [doc, error, ga]);

  React.useEffect(() => {
    const location = document.location;
    // Did you arrive on this page with a location hash?
    if (location.hash && location.hash !== location.hash.toLowerCase()) {
      // The location hash isn't lowercase. That probably means it's from before
      // we made all `<h2 id>` and `<h3 id>` values always lowercase.
      // Let's see if it can easily be fixed, but let's be careful and
      // only do this if there is an element that matches.
      try {
        if (document.querySelector(location.hash.toLowerCase())) {
          location.hash = location.hash.toLowerCase();
        }
      } catch (error) {
        if (error instanceof DOMException) {
          // You can't assume that the anchor on the page is a valid string
          // for `document.querySelector()`.
          // E.g. /en-US/docs/Web/HTML/Element/input#Form_<input>_types
          // So if that the case, just ignore the error.
          // It's not that critical to correct anyway.
        } else {
          throw error;
        }
      }
    }
  }, []);

  if (!doc && !error) {
    return <LoadingDocumentPlaceholder />;
  }

  if (error) {
    return <LoadingError error={error} />;
  }

  if (!doc) {
    return null;
  }

  const translations = doc.other_translations || [];

  const isServer = typeof window === "undefined";

  return (
    <>
      <Titlebar docTitle={doc.title}>
        {!isServer && CRUD_MODE && !props.isPreview && !doc.isArchive && (
          <React.Suspense
            fallback={<p className="loading-toolbar">Loading toolbar</p>}
          >
            <Toolbar
              doc={doc}
              reloadPage={() => {
                mutate(dataURL);
              }}
            />
          </React.Suspense>
        )}
      </Titlebar>

      {doc.isArchive && !doc.isTranslated && <Archived />}

      <div className="breadcrumbs-locale-container">
        <div className="breadcrumb-container">
          {doc.parents && <Breadcrumbs parents={doc.parents} />}
        </div>

        <div className="locale-container">
          {translations && !!translations.length && (
            <LanguageMenu translations={translations} locale={locale} />
          )}
        </div>
      </div>

      <div className="page-content-container">
        {doc.toc && !!doc.toc.length && <TOC toc={doc.toc} />}

        <MainContentContainer>
          <article className="article">
            <RenderDocumentBody doc={doc} />
          </article>
        </MainContentContainer>

        {doc.sidebarHTML && <RenderSideBar doc={doc} />}
      </div>
      <Metadata doc={doc} locale={locale} />
    </>
  );
}

function LoadingDocumentPlaceholder() {
  return (
    <>
      <Titlebar docTitle={"Loading…"} />
      <Dino className="page-content-container loading-document-placeholder" />
    </>
  );
}

function Archived() {
  return (
    <div className="archived">
      <p>
        <b>This is an archived page.</b> It's not actively maintained.
      </p>
    </div>
  );
}

/** These prose sections should be rendered WITHOUT a heading. */
const PROSE_NO_HEADING = ["short_description", "overview"];

function RenderDocumentBody({ doc }) {
  return doc.body.map((section, i) => {
    if (section.type === "prose") {
      // Only exceptional few should use the <Prose/> component,
      // as opposed to <ProseWithHeading/>.
      if (!section.value.id || PROSE_NO_HEADING.includes(section.value.id)) {
        return (
          <Prose
            key={section.value.id || `prose${i}`}
            section={section.value}
          />
        );
      } else {
        return (
          <ProseWithHeading
            key={section.value.id}
            id={section.value.id}
            section={section.value}
          />
        );
      }
    } else if (section.type === "interactive_example") {
      return (
        <InteractiveExample
          key={section.value.url}
          url={section.value.url}
          height={section.value.height}
          title={doc.title}
        />
      );
    } else if (section.type === "attributes") {
      return <Attributes key={`attributes${i}`} attributes={section.value} />;
    } else if (section.type === "specifications") {
      return (
        <Specifications
          key={`specifications${i}`}
          specifications={section.value}
        />
      );
    } else if (section.type === "browser_compatibility") {
      return (
        <LazyBrowserCompatibilityTable
          key={`browser_compatibility${i}`}
          {...section.value}
        />
      );
    } else if (section.type === "examples") {
      return <Examples key={`examples${i}`} examples={section.value} />;
    } else if (section.type === "info_box") {
      // XXX Unfinished!
      // https://github.com/mdn/stumptown-content/issues/106
      console.warn("Don't know how to deal with info_box!");
      return null;
    } else if (
      section.type === "class_constructor" ||
      section.type === "static_methods" ||
      section.type === "instance_methods"
    ) {
      return (
        <LinkList
          key={`${section.type}${i}`}
          title={section.value.title}
          links={section.value.content}
        />
      );
    } else if (section.type === "link_lists") {
      return <LinkLists key={`linklists${i}`} lists={section.value} />;
    } else {
      console.warn(section);
      throw new Error(`No idea how to handle a '${section.type}' section`);
    }
  });
}

function LoadingError({ error }) {
  return (
    <div className="page-content-container loading-error">
      <h3>Loading Error</h3>
      {error instanceof window.Response ? (
        <p>
          <b>{error.status}</b> on <b>{error.url}</b>
          <br />
          <small>{error.statusText}</small>
        </p>
      ) : (
        <p>
          <code>{error.toString()}</code>
        </p>
      )}
      <p>
        <a href=".">Try reloading the page</a>
      </p>
    </div>
  );
}
