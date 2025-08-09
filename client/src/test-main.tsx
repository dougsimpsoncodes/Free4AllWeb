import { createRoot } from "react-dom/client";

function SimpleTest() {
  return (
    <div style={{ padding: '20px', background: 'lightblue' }}>
      <h1>Hello World - React is working!</h1>
      <p>If you can see this, React is mounting properly.</p>
    </div>
  );
}

const root = document.getElementById("root");
console.log("Root element:", root);

if (root) {
  console.log("Creating React root...");
  createRoot(root).render(<SimpleTest />);
  console.log("React root created and rendered!");
} else {
  console.error("Could not find root element!");
}