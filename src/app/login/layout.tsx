export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      {children}
    </div>
  );
}
