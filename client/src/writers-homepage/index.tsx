import React, { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { PageContentContainer } from "../ui/atoms/page-content";
import { Search } from "../ui/molecules/search";

// Lazy sub-components
const ViewedDocuments = lazy(() => import("./viewed-documents"));

export default function WritersHomepage() {
  const isServer = typeof window === "undefined";

  return (
    <PageContentContainer>
      <h2>Welcome to MDN</h2>
      <Search />

      {!isServer && (
        <Suspense fallback={null}>
          <ViewedDocuments />
        </Suspense>
      )}

      <h3>Sample pages</h3>
      <ul>
        <li>
          <Link to="/en-US/docs/MDN/Kitchensink">The Kitchensink</Link>
        </li>
        <li>
          <Link to="/en-US/docs/Web/HTML">Web/HTML index</Link>
          <ul>
            <li>
              <Link to="/en-US/docs/Web/HTML/Element/video">HTML/video</Link>
            </li>
          </ul>
        </li>

        <li>
          <Link to="/en-US/docs/Web/API">Web/API index</Link>
          <ul>
            <li>
              <Link to="/en-US/docs/Web/API/Fetch_API/Using_Fetch">
                Using Fetch API
              </Link>
            </li>
          </ul>
        </li>
        <li>
          <Link to="/en-US/docs/Web/CSS">Web/CSS index</Link>
          <ul>
            <li>
              <Link to="/en-US/docs/Web/CSS/Specificity">CSS Specificity</Link>
            </li>
          </ul>
        </li>
        <li>
          <Link to="/en-US/docs/Web/JavaScript">Web/JavaScript index</Link>
          <ul>
            <li>
              <Link to="/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach">
                Array.prototype.forEach()
              </Link>
            </li>
          </ul>
        </li>
        <li>
          <Link to="/en-US/docs/Mozilla/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs">
            Page with lots of BCD tables
          </Link>
        </li>
        <li>
          <Link to="/en-US/docs/Web/API/Document/#Browser_compatibility">
            Largest BCD table
          </Link>
        </li>
      </ul>
      <h3>Tools</h3>
      <ul>
        <li>
          <Link to="/en-US/_flaws">Flaws Dashboard</Link>
        </li>
      </ul>
    </PageContentContainer>
  );
}
