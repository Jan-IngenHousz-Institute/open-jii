import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import sanitizeHtml from "sanitize-html";

const ALLOWED_EMAIL_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "ins",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "blockquote",
    "pre",
    "code",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "div",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel", "width", "align"],
    img: ["src", "alt", "width", "height", "style"],
    table: ["cellpadding", "cellspacing", "border", "width", "align", "bgcolor"],
    td: ["colspan", "rowspan", "align", "valign", "style", "width", "height", "bgcolor"],
    th: ["colspan", "rowspan", "align", "valign", "scope", "style", "width", "height", "bgcolor"],
    tr: ["bgcolor", "align", "valign"],
    "*": ["class", "style"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  disallowedTagsMode: "discard",
};

export interface EmailProps {
  host: string;
  senderName?: string;
  baseUrl: string;
  cmsContent: string;
  cmsPreview: string;
}

export const Email = ({
  host,
  senderName = "openJII",
  baseUrl,
  cmsContent,
  cmsPreview,
}: EmailProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>{cmsPreview}</Preview>
        <Body className="bg-[#005E5E]/15 font-sans">
          <Section className="w-full text-center">
            <Img
              src={`${baseUrl}/openJII_logo_RGB_horizontal_yellow.png`}
              alt="openJII"
              width={205}
              className="mx-auto"
            />
          </Section>

          <Container className="mx-auto w-full">
            <div
              className="rounded-t-xl bg-white p-1"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsContent, ALLOWED_EMAIL_HTML) }}
            />

            {/* Footer */}
            <Section className="rounded-b-xl border-t border-gray-100 bg-gray-50 px-8 py-4">
              <Text className="m-0 text-center text-[12px] text-gray-400">
                This email was sent by {senderName} • {host}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default Email;
