import { Translation } from "../../../document/types";

import "./index.scss";

export function LanguageToggle({
  locale,
  translations,
}: {
  locale: string;
  translations: Translation[];
}) {
  function getLink(locale) {
    if (locale.toLowerCase() !== "en-us") {
      for (const translation of translations) {
        if (translation.locale.toLowerCase() === "en-us") {
          return (
            <a href={translation.url} className="icon language-icon default">
              <span className="show-desktop">View in</span> English
            </a>
          );
        }
        return null;
      }
    } else {
      return (
        <a href="#select_language" className="icon language-icon">
          <span className="show-desktop">Change language</span>
        </a>
      );
    }
  }

  return (
    <ul className="language-toggle">
      <li>{getLink(locale)}</li>
    </ul>
  );
}