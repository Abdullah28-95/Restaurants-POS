import type {Metadata} from 'next'; import './globals.css';
export const metadata:Metadata={title:'Futec Restaurant POS',description:'Restaurant point of sale rebuilt in Next.js'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
