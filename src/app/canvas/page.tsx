import DataCanvas from '@/components/canvas/DataCanvas';

export default function CanvasPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-zinc-950">
      <DataCanvas canvasId="demo" />
    </main>
  );
}
