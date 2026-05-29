import DrawCanvas from "./components/DrawCanvas";

export default function Page() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Draw lines</h1>
      <DrawCanvas width={800} height={400} strokeColor="#0b63ff" strokeWidth={3} />
    </main>
  );
}