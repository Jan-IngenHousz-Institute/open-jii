import Image from "next/image";
import Link from "next/link";

export function Navigation() {
  return (
    <header className="pl-20 pr-20 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Image src="/jan-ingenhousz-institute-logo-header.png" alt="Jan IngenHousz Institute Logo" width={250} height={48} loading={"eager"} />
        </Link>
        <nav>
          <Link className="p-4" href="/experiment">Experiment</Link>
          <Link className="p-4" href="#">Link 2</Link>
          <Link className="p-4" href="#">Link 3</Link>
          <Link className="p-4" href="#">Link 4</Link>
        </nav>
      </div>
    </header>
  );
}