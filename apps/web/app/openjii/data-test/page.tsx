const items = [1, 2, 3];

export default function DataExamplePage() {
  return (
    <div>
      <h1>Data Example Page</h1>
      <ul className="mt-4 list-disc">
        {items.map((item, index) => {
          return (
            <li key={index}>
              <a href={`/openjii/data-test/${item}`}>Variant {item}</a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
