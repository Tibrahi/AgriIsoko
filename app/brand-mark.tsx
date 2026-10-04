import Image from "next/image";

export default function BrandMark() {
  return <span className="brand-mark"><Image src="/logo.png" alt="" width={40} height={40} priority /></span>;
}
