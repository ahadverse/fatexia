/**
 * Renders a structured-data block.
 *
 * `dangerouslySetInnerHTML` is the documented way to emit JSON-LD in React — putting
 * the JSON in a child would have React escape `<`, `>` and `&` into entities that
 * crawlers then fail to parse. The `<` escape below closes the one real hole in that
 * approach: a `</script>` sequence inside any string value would otherwise end the tag
 * early. Everything passed in is our own copy, but the guard costs nothing.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
