import React, { useState } from "react";
import { useGA } from "../../../ga-context";

import { Toc } from "../../types";

import "./index.scss";

export function TOC({ toc }: { toc: Toc[] }) {
  const ga = useGA();
  const [showTOC, setShowTOC] = useState(false);

  /**
   * Send a signal to GA when the user clicks on one of links
   * in the table of contents
   */
  function sendTOCClicks(event: React.MouseEvent) {
    if (event.target instanceof HTMLAnchorElement) {
      const action = event.target.textContent;
      const label = new URL(event.target.href).hash;
      ga("send", {
        hitType: "event",
        eventCategory: "MozMenu",
        eventAction: action,
        eventLabel: label,
      });
    }
  }

  return (
    <aside className="document-toc-container">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <section className="document-toc" onClick={sendTOCClicks}>
        <header>
          <h2>Table of contents</h2>
          <button
            type="button"
            className="ghost toc-trigger-mobile"
            onClick={() => {
              setShowTOC(!showTOC);
            }}
            aria-controls="toc-entries"
            aria-expanded={showTOC}
          >
            Table of contents
          </button>
        </header>
        <ul id="toc-entries" className={showTOC ? "show-toc" : undefined}>
          {toc.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id.toLowerCase()}`}
                dangerouslySetInnerHTML={{ __html: item.text }}
              ></a>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
