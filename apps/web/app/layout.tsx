import { Roboto } from "next/font/google";
import ThemeRegistry from "./ThemeRegistry";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const metadata = {
  title: "PHR — Personal Health Record",
  description: "Personal Health Record — keep your family's medical documents organized in one secure place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
