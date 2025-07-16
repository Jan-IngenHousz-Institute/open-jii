import { Parser } from "htmlparser2";

export function extractTextFromHTML(html: string): string {
  let result = "";

  const parser = new Parser(
    {
      ontext(text) {
        result += text;
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  return result;
}
