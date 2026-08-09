// Full-page brand gradient (amber → deep sienna, diagonal, matching the
// logo's own gradient direction — see --brand-gradient in globals.css).
// The card itself stays white so form fields remain highly legible; the
// gradient never sits directly behind input fields, only around the card.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-gradient px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
