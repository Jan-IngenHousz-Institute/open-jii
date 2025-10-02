import ReactDOM from "react-dom/client";

export function renderIntoElement(element: HTMLElement, reactComponent: React.ReactNode) {
  const root = ReactDOM.createRoot(element);
  root.render(reactComponent);
}
