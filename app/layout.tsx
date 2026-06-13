import './globals.css';

export const metadata = {
  title: 'Agritech AI Platform',
  description: 'AI-powered crop recommendation for rural centers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
