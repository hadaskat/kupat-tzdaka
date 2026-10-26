import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The web document shell. Setting dir/lang here rather than at runtime means
 * the very first paint is already right-to-left, with no flash of a
 * left-to-right layout.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: bodyStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const bodyStyle = `
  body { background-color: #F1F5F9; }
  * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Rubik, Arial, sans-serif; }
`;
